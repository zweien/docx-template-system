# 内网离线部署（对接 Authentik）

本文档用于办公内网环境（无公网）下，将本系统与**已部署的 Authentik**联调并上线。

> **完整的内网部署指南（含源码构建方式、Docker 网络配置、排障指南）请参阅 [deploy.md](deploy.md) 的「内网部署」章节。**

## 1. 前置条件

- 内网服务器已安装 Docker + Docker Compose 插件
- 内网 PostgreSQL 可访问（建议独立库与独立账号）
- 内网 Authentik 可访问
- 已准备离线镜像包（例如 `docx-template-system-offline.tar`）

## 2. Authentik 侧配置

在 Authentik 创建 OIDC 应用并记录以下参数：

- `AUTHENTIK_ISSUER`
  - 示例：`http://authentik.intra.local/application/o/docx-template-system`
- `AUTHENTIK_CLIENT_ID`
- `AUTHENTIK_CLIENT_SECRET`

回调地址（Redirect URI）必须包含：

```text
http://<应用地址>:8060/api/auth/callback/authentik
```

> **重要**：回调地址中的 `http://<应用地址>:8060` 必须与 `.env.production` 中 `NEXTAUTH_URL` 完全一致。如果不一致会导致 OAuth 回调失败。

建议 Scope 至少包含：`openid profile email`。

## 3. 生成离线环境配置

```bash
cp .env.offline.example .env.production
```

重点检查并修改以下变量：

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTHENTIK_ISSUER`
- `AUTHENTIK_CLIENT_ID`
- `AUTHENTIK_CLIENT_SECRET`
- `AUTHENTIK_LOGOUT_REDIRECT_URL`
- `AUTHENTIK_ADMIN_EMAILS` — 管理员邮箱列表，逗号分隔。匹配的 Authentik 用户首次登录将获得 ADMIN 角色

如需临时绕过统一登录（仅排障）：

```env
DEV_BYPASS_AUTH=true
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
```

> **注意**：`DEV_BYPASS_AUTH` 在 `NODE_ENV=production` 时会被代码硬拦截，设为 `true` 会导致服务无法启动。仅用于本地开发调试。

## 4. 一键部署

```bash
chmod +x scripts/deploy-offline.sh
./scripts/deploy-offline.sh --image-tar /path/to/docx-template-system-offline.tar
```

脚本将自动执行：

1. 加载离线镜像（可选）
2. 校验关键环境变量（含 Authentik 变量）
3. 启动服务：`docker compose -f docker-compose.offline.yml`
4. 同步数据库结构：`npx prisma db push`
5. 健康检查：`http://127.0.0.1:<APP_PORT>`

## 5. 登录联调检查

1. 访问：`http://<应用地址>:8060/login`
2. 点击登录，应跳转到 Authentik
3. 登录成功后，应回跳应用并建立会话
4. 首次登录若邮箱在 `AUTHENTIK_ADMIN_EMAILS` 中，应授予本地 `ADMIN`

## 6. 常见问题

### 6.1 回调失败 / 400

通常是 `NEXTAUTH_URL` 与 Authentik Redirect URI 不一致（协议、域名、端口、路径任一不一致）。

### 6.2 登录页不跳 Authentik

检查：

- `DEV_BYPASS_AUTH` 是否仍为 `true`
- `AUTHENTIK_ISSUER` 是否填写了应用级 issuer（不是根地址）

### 6.3 登录成功但权限不对

本项目使用本地 RBAC，统一登录只负责身份认证。
检查 `AUTHENTIK_ADMIN_EMAILS` 是否包含对应邮箱。

### 6.4 HTTPS 自签名证书问题

若 Authentik 使用自签名证书，请确保运行容器信任该 CA，或先在内网使用受信任证书/HTTP 进行联调。

### 6.5 数据库重置后操作失败（Foreign Key Constraint）

数据库被重新 seed 或重置后，已有 JWT session 中的用户 ID 与数据库不匹配。需要清除浏览器 session 重新登录，或将数据库用户 ID 对齐为 JWT 中的值。详见 [deploy.md](deploy.md) 的排障指南。
