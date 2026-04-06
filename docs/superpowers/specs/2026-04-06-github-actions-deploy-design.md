# GitHub Actions 部署到 VPS 设计

## 目标

通过 GitHub Actions 在 master 分支的 git tag 推送时，自动 SSH 到 VPS 执行部署。使用 Docker Compose 运行 Next.js 应用和 Python 服务，连接 VPS 已有的 PostgreSQL。

## 环境信息

| 项目 | 值 |
|------|------|
| VPS IP | `192.227.137.51` |
| SSH 用户 | `root` |
| 域名 | `doc.idrl.top` |
| Authentik URL | `https://auth.idrl.top` |
| 应用端口 | `8060` |
| Python 服务端口 | `8065` |
| 部署目录 | `/opt/docx-template-system` |

## 架构

```
git tag v1.2.3 push → GitHub Actions → SSH 到 VPS
    → git pull → docker compose build → docker compose up -d → 健康检查
```

## 文件结构

| 文件 | 职责 |
|------|------|
| `Dockerfile` | Next.js 多阶段构建（deps → build → production） |
| `docker-compose.yml` | 定义 app + python-service 容器 |
| `.dockerignore` | 排除 node_modules、.next、uploads 等 |
| `.github/workflows/deploy.yml` | tag 触发的部署工作流 |

## Dockerfile

Next.js standalone 多阶段构建：

1. **deps 阶段**：`npm ci` 安装依赖
2. **builder 阶段**：`prisma generate` + `next build`，需要 standalone 输出模式
3. **runner 阶段**：复制 standalone 输出、`.next/static`、`public` 目录。同时复制 `prisma/` 目录（standalone 输出可能不包含 schema），以便在启动时执行 `prisma db push`

需要在 `next.config.ts` 中添加 `output: 'standalone'` 以启用独立输出模式。

## docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "127.0.0.1:8060:8060"
    env_file: .env.production
    environment:
      - PYTHON_SERVICE_URL=http://python-service:8065
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads
      - collection-uploads:/app/.data/uploads

  python-service:
    build: ./python-service
    ports:
      - "127.0.0.1:8065:8065"
    environment:
      - PORT=8065
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads:ro

volumes:
  uploads:
  collection-uploads:
```

关键决策：
- `app` 只绑定 `127.0.0.1:8060`，由 Nginx 反代，不直接暴露到公网
- `PYTHON_SERVICE_URL` 使用 Docker 内部网络地址（`python-service`），不再走 localhost
- `uploads` 用 named volume 持久化，**同时挂载到 python-service（只读）**，因为 Python 服务需要读取模板文件路径
- `collection-uploads` 持久化 `.data/uploads`（COLLECTION_UPLOAD_DIR 默认值）
- Python 服务通过环境变量 `PORT=8065` 覆盖默认端口
- 数据库连接通过 `.env.production` 中的 `DATABASE_URL` 指向 VPS 已有 PG

## Python 服务适配

现有 `python-service/Dockerfile` 的 `EXPOSE 8000` 与实际运行端口 8065 不一致。不修改 Dockerfile，而是在 `docker-compose.yml` 中通过环境变量 `PORT=8065` 控制，Nginx 配置反代到 8065 即可。

Next.js 通过 HTTP POST 调用 Python 服务的 `/generate` 接口，Python 返回 `FileResponse`（HTTP 文件流），Next.js 端通过 response body 获取文件内容。因此 **OUTPUT_DIR 不需要跨容器共享**，Python 容器内 `/tmp/docx-output` 即可。

但 **template_path 必须共享**：Next.js 将模板上传到 `public/uploads/templates/{id}/`，Python 服务需要读取该路径下的模板文件。因此 `uploads` volume 需要同时挂载到两个容器。

## .env.production

VPS 上的生产环境变量文件（不在 Git 中），需要包含：

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/docx_template_system"
NEXTAUTH_SECRET="<random-secret>"
NEXTAUTH_URL="https://doc.idrl.top"
AUTHENTIK_ISSUER="https://auth.idrl.top/application/o/docx-template-system/"
AUTHENTIK_CLIENT_ID="<from-authentik>"
AUTHENTIK_CLIENT_SECRET="<from-authentik>"
AUTHENTIK_LOGOUT_REDIRECT_URL="https://doc.idrl.top"
AUTHENTIK_ADMIN_EMAILS="admin@example.com"
AI_PROVIDER="openai"
AI_API_KEY="<key>"
AI_BASE_URL="<url>"
AI_MODEL="<model>"
MODEL_CONFIG_ENCRYPTION_KEY="<key>"
UPLOAD_DIR="public/uploads"
```

## GitHub Actions 工作流

**触发条件**：master 分支上的 tag 推送（格式 `v*`）

**步骤**：
1. 使用 `appleboy/ssh-action` SSH 到 VPS
2. 在部署目录执行 `git fetch --tags && git checkout $TAG`
3. `docker compose build` 重新构建镜像
4. `docker compose run --rm app npx prisma db push` 同步数据库 schema
5. `docker compose up -d --remove-orphans` 启动服务
6. 健康检查：等待 15 秒后 curl 验证服务是否启动成功

**GitHub Secrets（需要配置）**：
- `VPS_HOST` — `192.227.137.51`
- `VPS_SSH_KEY` — root 用户的 SSH 私钥

**VPS 上的 Git 认证**：如果仓库是 private，需要在 VPS 上配置 GitHub Deploy Key 或 Personal Access Token。如果仓库是 public，`git clone/pull` 无需认证。

## VPS 初始化（一次性手动操作）

```bash
# 1. 创建部署目录并克隆代码
mkdir -p /opt/docx-template-system
cd /opt/docx-template-system
git clone https://github.com/zweien/docx-template-system.git .

# 2. 如果仓库是 private，配置 deploy key
# 将 SSH 公钥添加到 GitHub 仓库 Settings → Deploy Keys
# 然后改用 SSH URL: git remote set-url origin git@github.com:zweien/docx-template-system.git

# 3. 创建 .env.production（按上述模板填写）

# 4. 配置 Nginx 反代
# /etc/nginx/sites-available/doc.idrl.top
server {
    listen 80;
    server_name doc.idrl.top;
    location / {
        proxy_pass http://127.0.0.1:8060;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 20M;
    }
}

# 5. 启用站点 + SSL
ln -sf /etc/nginx/sites-available/doc.idrl.top /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d doc.idrl.top --non-interactive --agree-tos -m admin@idrl.top

# 6. 初始部署
docker compose build
docker compose run --rm app npx prisma db push
docker compose up -d
```

## Authentik 接入

在 Authentik 后台创建应用：

1. **Provider**: OAuth2/OpenID Provider
   - Name: `docx-template-system-provider`
   - Client type: Confidential
   - Redirect URIs: `https://doc.idrl.top/api/auth/callback/authentik`
   - Scopes: `openid profile email`

2. **Application**:
   - Slug: `docx-template-system`
   - Launch URL: `https://doc.idrl.top`

记录 Client ID 和 Client Secret 填入 `.env.production`。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `Dockerfile` | 新建 |
| `docker-compose.yml` | 新建 |
| `.dockerignore` | 新建 |
| `.github/workflows/deploy.yml` | 新建 |
| `next.config.ts` | 添加 `output: 'standalone'` |

## 不做的事

- 不配置 Docker Registry（直接在 VPS 上构建）
- 不设置 CI 测试流水线（仅部署）
- 不做蓝绿部署或零停机（docker compose up -d 已够用）
- 不自动配置 Nginx/SSL（一次性手动操作）
