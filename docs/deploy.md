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

## 内网部署

### 架构

```
内网用户 -> Nginx (80) [可选] -> Docker (8060) -> Next.js App
                                              -> Python Service (8065)
                                              -> PostgreSQL (内网独立部署或容器)
                                              -> Authentik SSO (内网已有)
```

提供两种部署方式，根据内网服务器是否有 Git / 能否访问 npm 仓库选择：

| 方式 | 适用场景 | 前置条件 |
|------|---------|---------|
| **方式一：离线镜像** | 完全隔离网络，无互联网访问 | 开发机构建镜像后传输 |
| **方式二：源码构建** | 有 Git / 可通过代理/镜像访问 npm | 服务器可直接 `docker compose build` |

---

### Authentik SSO 配置（两种方式通用）

在 Authentik 管理后台操作，**必须在部署应用前完成**：

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

> **重要**：Redirect URI 中的地址必须与 `.env.production` 中 `NEXTAUTH_URL` 完全一致（包括协议、IP/域名、端口）。如果后续变更了访问地址，需同步更新 Authentik 的 Redirect URI。

---

### 环境变量配置（两种方式通用）

```bash
cp .env.offline.example .env.production
```

编辑 `.env.production`：

```env
# 基础配置
APP_PORT=8060
NEXTAUTH_URL="http://<内网IP或域名>:8060"
NEXTAUTH_SECRET="<用 openssl rand -hex 32 生成>"
UPLOAD_DIR="public/uploads"

# 数据库
# - 如果使用机器上已有的 PostgreSQL 容器，填写容器名作为主机名（如 postgres）
#   并确保 app 容器与 postgres 在同一 Docker 网络
# - 如果使用独立 PostgreSQL 服务器，填写实际 IP
DATABASE_URL="postgresql://docx_user:<密码>@<PG地址>:5432/docx_template_system"

# 认证：Authentik SSO
DEV_BYPASS_AUTH="false"
NEXT_PUBLIC_DEV_BYPASS_AUTH="false"
AUTHENTIK_ISSUER="http://<Authentik地址>/application/o/docx-template-system"
AUTHENTIK_CLIENT_ID="<从 Authentik 获取>"
AUTHENTIK_CLIENT_SECRET="<从 Authentik 获取>"
AUTHENTIK_LOGOUT_REDIRECT_URL="http://<内网IP或域名>:8060"
# 管理员邮箱列表，逗号分隔。匹配的 Authentik 用户首次登录将获得 ADMIN 角色
AUTHENTIK_ADMIN_EMAILS="admin@example.com"

# AI（可选，内网无则留空）
AI_PROVIDER=""
AI_BASE_URL=""
AI_API_KEY=""
AI_MODEL=""
```

> **注意**：`DEV_BYPASS_AUTH` 在生产环境中会被硬拦截（代码级别检查），即使设为 `true` 也会导致服务无法启动。仅用于本地开发调试。

---

### 方式一：离线镜像部署

适用于完全隔离网络、无法访问外网的环境。

#### 在开发机上构建镜像

```bash
git clone https://github.com/zweien/docx-template-system.git
cd docx-template-system
git checkout <目标版本>

# 构建主应用镜像
docker build -t docx-template-system-app:<版本号> .

# 构建 Python 服务镜像
docker build -t docx-template-system-python-service:<版本号> ./python-service/

# 导出镜像为 tar（用于 U 盘/内网传输）
docker save \
  docx-template-system-app:<版本号> \
  docx-template-system-python-service:<版本号> \
  -o docx-offline-images-<版本号>.tar

# 如果内网没有 PostgreSQL，也导出 PG 镜像
docker pull postgres:16-alpine
docker save postgres:16-alpine -o postgres-16-alpine.tar
```

#### 传输到内网服务器

拷贝以下文件到内网服务器部署目录（如 `/opt/docx/`）：

```
docx-offline-images-<版本号>.tar   # Docker 镜像
postgres-16-alpine.tar              # PG 镜像（如需要）
docker-compose.offline.yml          # 编排文件
.env.production                     # 环境变量（已配置好）
```

#### 在内网服务器上部署

```bash
cd /opt/docx

# 1. 加载镜像
docker load -i docx-offline-images-<版本号>.tar
docker load -i postgres-16-alpine.tar   # 如需要

# 2. 启动服务
docker compose -f docker-compose.offline.yml up -d

# 3. 同步数据库 Schema（首次部署或版本升级后执行）
docker compose -f docker-compose.offline.yml run --rm --user root app npx prisma db push

# 4. 初始化种子数据（仅首次部署）
docker compose -f docker-compose.offline.yml run --rm --user root app npx prisma db seed

# 5. 健康检查
curl -sf http://127.0.0.1:8060
```

或使用部署脚本一键执行：

```bash
bash scripts/deploy-offline.sh --image-tar docx-offline-images-<版本号>.tar
```

---

### 方式二：源码构建部署

适用于内网服务器有 Git 访问权限、可通过代理或镜像源访问 npm 仓库的环境。

#### 1. 获取源码

```bash
cd /mnt/docx-template-system   # 或其他部署目录
git clone https://github.com/zweien/docx-template-system.git .
git checkout <目标版本>
```

#### 2. 配置 npm 镜像（国内网络必须）

如果内网无法直接访问 `registry.npmjs.org`，创建 `.npmrc` 指向国内镜像：

```bash
echo "registry=https://registry.npmmirror.com" > .npmrc
```

> **关键**：Docker 构建时容器内也需要能访问 npm 仓库。`.npmrc` 文件必须在 Dockerfile 中被 COPY 进去。如果使用项目标准 Dockerfile，需要在 deps 阶段添加：
>
> ```dockerfile
> COPY package.json package-lock.json .npmrc ./
> ```

#### 3. 配置 Docker Compose

根据网络环境修改 `docker-compose.yml`：

**连接已有 PostgreSQL 容器**（同一台机器上已有 postgres 容器）：

```yaml
services:
  app:
    build:
      context: .
      args:
        - NEXT_PUBLIC_DINGTALK_CORP_ID=${NEXT_PUBLIC_DINGTALK_CORP_ID}
      # 国内网络构建时添加（让构建阶段能访问 npm）
      network: host
    ports:
      - "0.0.0.0:8060:8060"
    env_file: .env.production
    environment:
      - PYTHON_SERVICE_URL=http://python-service:8065
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads
      - collection-uploads:/app/.data/uploads
      - backups:/app/.data/backups
    networks:
      - default
      - db_net        # 连接已有 PostgreSQL 所在的 Docker 网络

  python-service:
    build: ./python-service
    environment:
      - PORT=8065
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads:ro

  collab:
    build:
      context: .
      network: host   # 构建时也需要网络
    ports:
      - "0.0.0.0:8072:8072"
    env_file: .env.production
    environment:
      - Y_WS_PORT=8072
      - Y_WS_PERSISTENCE_DIR=/app/y-websocket-db
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - collab-persistence:/app/y-websocket-db
    command: ["node", "y-websocket-server/server.cjs"]

volumes:
  uploads:
  collection-uploads:
  backups:
  collab-persistence:

networks:
  db_net:
    external: true
    name: <已有 postgres 所在的 Docker 网络名>
```

`DATABASE_URL` 中主机名填写 postgres 容器名（如 `postgres`），Docker 网络会自动解析。

**自带 PostgreSQL**（内网无 PG 时使用）：

在 docker-compose.yml 中添加 postgres 服务，`DATABASE_URL` 改为：

```env
DATABASE_URL="postgresql://docx_user:<密码>@postgres:5432/docx_template_system"
```

#### 4. 构建与启动

```bash
# 构建镜像
docker compose build

# 同步数据库 Schema（首次部署或版本升级后执行）
docker compose run --rm --user root app npx prisma db push

# 初始化种子数据（仅首次部署）
docker compose run --rm --user root app npx prisma db seed

# 启动
docker compose up -d

# 健康检查
curl -sf http://127.0.0.1:8060
```

#### 5. 版本升级

```bash
git pull
git checkout <新版本>

# 如果依赖有变化或 Dockerfile 修改过
docker compose build

# 同步数据库 Schema
docker compose run --rm --user root app npx prisma db push

# 重启
docker compose up -d
```

数据通过 Docker Volume 持久化，升级不影响已有数据。

---

### Nginx 反向代理（可选）

如需通过域名/IP 统一入口访问，需配置 `X-Forwarded-Proto` 和 `Host` 头以保证 OAuth 回调地址正确：

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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

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

---

## 内网部署排障指南

### Docker 构建失败：npm 网络超时

**症状**：`docker compose build` 时 `npm ci` 或 `npx prisma generate` 报 ETIMEDOUT / EAI_AGAIN。

**原因**：Docker 容器内无法访问 `registry.npmjs.org`。

**解决方案**：

1. 创建 `.npmrc` 使用国内镜像：
   ```bash
   echo "registry=https://registry.npmmirror.com" > .npmrc
   ```

2. 修改 Dockerfile，在 deps 阶段 COPY `.npmrc`：
   ```dockerfile
   COPY package.json package-lock.json .npmrc ./
   ```

3. 在 `docker-compose.yml` 的 build 配置中添加 `network: host`（让构建阶段使用宿主机网络，走代理）：
   ```yaml
   build:
     context: .
     network: host
   ```

4. 如果 `--no-cache` 构建失败但普通构建也失败，这是因为 BuildKit 会检查远程 registry 元数据。可用旧版构建器绕过：
   ```bash
   DOCKER_BUILDKIT=0 docker compose build app
   ```

### 浏览器无法访问 Docker 端口（宿主机 curl 正常）

**症状**：`curl http://localhost:8060` 正常，但同一内网其他机器浏览器访问 `http://<服务器IP>:8060` 无法连接。

**原因**：宿主机上的代理软件（Clash Verge / Mihomo）的 TUN 模式拦截了 Docker bridge 网络流量。TUN 模式会创建虚拟网卡（如 `198.18.0.1/30`），将所有流量导入代理规则，导致 Docker bridge 网络的数据包无法正常路由。

**解决方案**（任选其一）：

1. **关闭 TUN 模式**（最简单）：在代理软件中关闭 TUN / 系统代理模式，改用浏览器插件代理。

2. **排除 Docker 网桥接口**：编辑 Clash 配置文件（通常在 `~/.local/share/io.github.clash-verge-rev.clash-verge-rev/clash-verge.yaml`），在 `tun` 部分添加 Docker 网桥到排除列表：
   ```yaml
   tun:
     enable: true
     stack: mixed
     exclude-interface:
       - br-xxxxxxxxxxxx   # Docker 网桥名，通过 ip link 查看
   ```

3. **添加直连路由规则**：在 Clash 的 `rules` 中添加：
   ```yaml
   rules:
     - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
     - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
   ```

4. **手动添加路由规则**（临时）：
   ```bash
   # 查找 Docker 网桥名
   ip link | grep br-

   # 添加路由规则，让 Docker 网桥流量绕过 TUN
   sudo ip rule add from all iif br-xxxxxxxxxxxx lookup main priority 8998
   ```

> **注意**：方案 2 和 4 在代理软件重启后可能需要重新配置。Docker 网桥名在 Docker 服务重启后可能改变。

### OAuth 登录后跳转到 localhost

**症状**：通过 Nginx 反向代理或非 localhost 地址访问时，Authentik 登录成功后回调到 `http://localhost:8060` 而非实际地址。

**原因**：NextAuth 在反向代理后面时，`req.url` 包含的是内部地址（如 `http://localhost:8060`），而非浏览器实际访问的地址。

**解决方案**：确保 Nginx 配置传递了以下 header：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

NextAuth 会按以下优先级解析回调地址：
1. `Origin` header
2. `X-Forwarded-Proto` + `Host` header
3. `req.url`（最后备选）

### 数据库重置后导入失败（Foreign Key Constraint）

**症状**：导入数据表时报错 `Foreign key constraint violated on the constraint: DataTable_createdById_fkey`。

**原因**：数据库被重新 seed 或重置后，新创建的用户 ID 与现有 JWT session 中缓存的用户 ID 不一致。`syncOidcUser` 在首次 OAuth 登录时将用户 ID 写入 JWT token，后续请求直接从 JWT 读取，不会重新查询数据库。如果数据库被重置但用户未清除浏览器 session，JWT 中的用户 ID 就会指向不存在的记录。

**诊断**：

```bash
# 查看数据库中的实际用户
docker exec <pg容器名> psql -U docx_user -d docx_template_system \
  -c 'SELECT id, email, role FROM "User";'

# 查看 app 日志确认 session 中的 userId
docker compose logs app --tail 50 | grep import
```

**解决方案**（任选其一）：

1. **对齐数据库用户 ID**（推荐）：将数据库中的用户 ID 更新为 JWT 中缓存的值：
   ```bash
   docker exec <pg容器名> psql -U docx_user -d docx_template_system -c "
   DELETE FROM \"User\" WHERE id = '<数据库中的旧ID>';
   INSERT INTO \"User\" (id, email, name, role, \"oidcSubject\", \"createdAt\", \"updatedAt\")
   VALUES ('<JWT中的用户ID>', '<用户邮箱>', '<用户名>', 'ADMIN', '<oidcSubject>', NOW(), NOW());
   "
   ```

2. **清除浏览器 session**：让用户清除浏览器 cookie 后重新通过 Authentik 登录，JWT 会重新生成。

3. **重启容器后清除 session**：重启 app 容器并让用户退出重登。

> **预防措施**：避免在用户已登录时重置数据库。如果必须重置，重置后应通知所有用户清除浏览器 session 再重新登录。

### Authentik 首次登录流程说明

了解首次 OAuth 登录的内部流程有助于排查问题：

1. 用户点击登录 → 浏览器跳转到 Authentik
2. Authentik 认证成功 → 回调到 `/api/auth/callback/authentik`
3. NextAuth JWT 回调执行 `syncOidcUser`：
   - 先按 `oidcSubject`（Authentik 的 `sub`）查找本地用户
   - 未找到则按 `email` 查找
   - 都未找到则创建新用户（角色由 `AUTHENTIK_ADMIN_EMAILS` 决定）
4. 用户 ID 写入 JWT token，后续请求不再执行此流程
5. session 回调从 JWT 读取用户 ID

**这意味着**：
- 数据库中的用户必须与 Authentik 用户的邮箱一致才能自动关联
- 修改 `AUTHENTIK_ADMIN_EMAILS` 只影响**新用户**的首次登录角色，已有用户不会自动变更
- 数据库重置后必须让用户重新登录以重建 JWT
