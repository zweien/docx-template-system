# 部署说明

## 外网部署（VPS）

### VPS 信息

| 项目 | 值 |
|------|------|
| VPS IP | `192.227.137.51` |
| 域名 | `doc.idrl.top` |
| 部署目录 | `/opt/docx-template-system` |
| 服务端口 | `8060`（仅本地监听 `127.0.0.1:8060`） |

### 架构

```
用户 -> Nginx (443/SSL) -> Docker (8060) -> Next.js App
                                          -> Python Service (8065)
                                          -> PostgreSQL (共用 idrl-sso-postgres)
```

容器网络 `deploy_sso_net` 与 Authentik SSO、PostgreSQL 共享。

### 自动部署（GitHub Actions）

推送到 `v*` tag 时自动触发，workflow 在 `.github/workflows/deploy.yml`。

```bash
# 发布新版本
npm run release           # patch bump
npm run release:minor     # minor bump
npm run release:major     # major bump
git push --follow-tags    # 触发自动部署
```

部署流程：SSH 到 VPS → `git fetch --tags --force` → `docker compose build` → `docker compose up -d`

### 手动部署

```bash
ssh root@192.227.137.51

cd /opt/docx-template-system
git fetch --tags --force
git checkout v0.10.1

docker compose build
docker compose run --rm --user root app npx prisma db push
docker compose up -d --remove-orphans
```

### Nginx 配置

配置文件：`/etc/nginx/sites-enabled/docx-template`

```nginx
server {
    server_name doc.idrl.top;

    location / {
        proxy_pass http://127.0.0.1:8060;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/doc.idrl.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/doc.idrl.top/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = doc.idrl.top) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name doc.idrl.top;
    return 404;
}
```

SSL 证书已通过 Certbot 签发，路径 `/etc/letsencrypt/live/doc.idrl.top/`。

---

## 内网离线部署

### 架构

```
内网用户 -> Nginx (80) -> Docker (8060) -> Next.js App
                                        -> Python Service (8065)
                                        -> PostgreSQL (内网独立部署或容器)
                                        -> Authentik SSO (内网已有)
```

### 前置条件

**开发机（有互联网）：**
- Docker + Docker Compose
- Git

**内网服务器：**
- Docker + Docker Compose（v2 插件）
- 如内网无 PostgreSQL，需一并准备 `postgres:16-alpine` 镜像

### 第一步：在开发机上构建镜像

```bash
git clone https://github.com/zweien/docx-template-system.git
cd docx-template-system
git checkout v0.10.1

# 构建主应用镜像
docker build -t docx-template-system-app:v0.10.1 .

# 构建 Python 服务镜像
docker build -t docx-template-system-python-service:v0.10.1 ./python-service/

# 导出镜像为 tar（用于 U 盘/内网传输）
docker save \
  docx-template-system-app:v0.10.1 \
  docx-template-system-python-service:v0.10.1 \
  -o docx-offline-images-v0.10.1.tar

# 如果内网没有 PostgreSQL，也导出 PG 镜像
docker pull postgres:16-alpine
docker save postgres:16-alpine -o postgres-16-alpine.tar
```

### 第二步：准备配置文件

```bash
cp .env.offline.example .env.offline
```

编辑 `.env.offline`：

```env
# 基础配置
APP_PORT=8060
NEXTAUTH_URL="http://<内网IP或域名>:8060"
NEXTAUTH_SECRET="<用 openssl rand -hex 32 生成>"
UPLOAD_DIR="public/uploads"

# 数据库（指向内网 PostgreSQL）
DATABASE_URL="postgresql://docx_user:<密码>@<PG地址>:5432/docx_template_system?schema=public"

# 认证：Authentik SSO
DEV_BYPASS_AUTH="false"
NEXT_PUBLIC_DEV_BYPASS_AUTH="false"
AUTHENTIK_ISSUER="http://<Authentik地址>/application/o/docx-template-system"
AUTHENTIK_CLIENT_ID="<从 Authentik 获取>"
AUTHENTIK_CLIENT_SECRET="<从 Authentik 获取>"
AUTHENTIK_LOGOUT_REDIRECT_URL="http://<内网IP或域名>:8060"
AUTHENTIK_ADMIN_EMAILS="admin@example.com"

# AI（可选，内网无则留空）
AI_PROVIDER=""
AI_BASE_URL=""
AI_API_KEY=""
AI_MODEL=""
```

### 第三步：Authentik SSO 配置

在 Authentik 管理后台操作：

1. **创建 Provider**
   - 类型：**OAuth2/OpenID Provider**
   - 名称：`docx-template-system`
   - Authorization flow：`default-provider-authorization-explicit-consent`
   - Redirect URI：`http://<内网IP或域名>:8060/api/auth/callback/authentik`
   - Post logout redirect URI：`http://<内网IP或域名>:8060`

2. **创建 Application**
   - 绑定上面创建的 Provider
   - 记录 **Client ID** 和 **Client Secret**

3. **记录 Issuer URL**
   - 格式：`http://<Authentik地址>/application/o/docx-template-system`

### 第四步：传输到内网服务器

通过 U 盘或内网文件传输，将以下文件拷贝到内网服务器部署目录（如 `/opt/docx/`）：

```
docx-offline-images-v0.10.1.tar    # Docker 镜像（约 800MB）
postgres-16-alpine.tar              # PG 镜像（如需要，约 80MB）
docker-compose.offline.yml          # 编排文件
.env.offline                        # 环境变量
scripts/deploy-offline.sh           # 部署脚本（可选）
```

### 第五步：在内网服务器上部署

```bash
cd /opt/docx

# 1. 加载镜像
docker load -i docx-offline-images-v0.10.1.tar

# 如果需要 PostgreSQL
docker load -i postgres-16-alpine.tar

# 2. 启动服务
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d

# 3. 同步数据库 Schema（首次部署或版本升级后执行）
docker compose -f docker-compose.offline.yml --env-file .env.offline \
  run --rm --user root app npx prisma db push

# 4. 初始化种子数据（仅首次部署，创建管理员/普通用户账号）
docker compose -f docker-compose.offline.yml --env-file .env.offline \
  run --rm --user root app npx prisma db seed

# 5. 健康检查
curl -sf http://127.0.0.1:8060
```

或使用部署脚本一键执行：

```bash
bash scripts/deploy-offline.sh --image-tar docx-offline-images-v0.10.1.tar
```

### 自带 PostgreSQL 的 docker-compose（内网无 PG 时使用）

在 `docker-compose.offline.yml` 中添加 PostgreSQL 服务：

```yaml
services:
  app:
    # ... 保持不变
    depends_on:
      - python-service
      - postgres

  python-service:
    # ... 保持不变

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: docx_user
      POSTGRES_PASSWORD: "<密码>"
      POSTGRES_DB: docx_template_system
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  uploads:
  collection-uploads:
  backups:
  pgdata:
```

对应 `.env.offline` 中 `DATABASE_URL` 改为：

```env
DATABASE_URL="postgresql://docx_user:<密码>@postgres:5432/docx_template_system?schema=public"
```

### Nginx 反向代理（可选）

如需通过域名/IP 统一入口访问：

```nginx
server {
    listen 80;
    server_name <内网域名或IP>;

    location / {
        proxy_pass http://127.0.0.1:8060;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

### 版本升级

```bash
# 开发机上
docker build -t docx-template-system-app:v0.11.0 .
docker build -t docx-template-system-python-service:v0.11.0 ./python-service/
docker save docx-template-system-app:v0.11.0 \
  docx-template-system-python-service:v0.11.0 \
  -o docx-offline-images-v0.11.0.tar

# 拷贝到内网后
docker load -i docx-offline-images-v0.11.0.tar

# 更新 docker-compose.offline.yml 中的镜像版本号
# 更新 .env.offline（如有新配置项）

docker compose -f docker-compose.offline.yml --env-file .env.offline up -d
docker compose -f docker-compose.offline.yml --env-file .env.offline \
  run --rm --user root app npx prisma db push
```

数据通过 Docker Volume 持久化，升级不影响已有数据。

---

## 通用运维

### Dockerfile 注意事项

#### prisma generate 需要占位 DATABASE_URL

`prisma.config.ts` 在加载时会读取 `.env.local`，Docker 构建时该文件不存在。因此在 builder 阶段设置占位 `DATABASE_URL`：

```dockerfile
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
```

#### 构建时需要环境变量

Next.js `collectPageData` 在 build 时会执行部分路由代码，这些路由依赖 `src/lib/authentik.ts` 中的 `readRequired()`，会检查环境变量存在。

因此 Dockerfile builder 阶段需要提供所有必要环境变量的占位值：

```dockerfile
ARG AUTHENTIK_ISSUER="placeholder"
ARG AUTHENTIK_CLIENT_ID="placeholder"
ARG AUTHENTIK_CLIENT_SECRET="placeholder"
# ... 其他必需的环境变量
```

### 数据库

外网 VPS 共用 `idrl-sso-postgres` 容器。内网独立部署。

```bash
# 手动执行 schema 同步
docker exec <app容器名> npx prisma db push

# 重置用户密码
docker exec <pg容器名> psql -U docx_user -d docx_template_system \
  -c "UPDATE \"User\" SET password='<bcrypt hash>' WHERE email='admin@example.com';"
```

### 健康检查

```bash
# 从服务器内部
curl -sf http://127.0.0.1:8060

# 从外部
curl -sI https://doc.idrl.top/

# 查看容器日志
docker compose logs --tail=50 app
docker compose logs --tail=50 python-service
```

### 备份

```bash
# 备份数据库
docker exec <pg容器名> pg_dump -U docx_user docx_template_system > backup_$(date +%Y%m%d).sql

# 备份上传文件
tar czf uploads_backup_$(date +%Y%m%d).tar.gz public/uploads/
```
