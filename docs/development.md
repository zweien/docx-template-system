# 开发运行说明

## 运行前提

本地开发至少要有：

- Node.js 20+
- PostgreSQL
- Python 3.10+
- 本地 authentik 实例

推荐端口：

- 文档模板系统：`8060`
- Python 文档服务：`8065`
- authentik：`9000`
- 门户：`8081`

## 启动顺序

建议固定按下面顺序启动：

1. 启动 PostgreSQL
2. 确认 authentik 已可访问
3. 启动 Python 文档服务
4. 启动 Next.js 开发服务

## 初始化步骤

### 1. 安装依赖

```bash
cd "/home/z/test-hub/docx-template-system"
npm install
```

### 2. 准备 `.env.local`

手动创建：

```bash
cd "/home/z/test-hub/docx-template-system"
cat > ".env.local" <<'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docx_template_system"
NEXTAUTH_SECRET="replace-with-random-secret"
NEXTAUTH_URL="http://localhost:8060"
UPLOAD_DIR="public/uploads"
PYTHON_SERVICE_URL="http://localhost:8065"
AUTHENTIK_ISSUER="http://127.0.0.1:9000/application/o/docx-template-system"
AUTHENTIK_CLIENT_ID="from-authentik"
AUTHENTIK_CLIENT_SECRET="from-authentik"
AUTHENTIK_LOGOUT_REDIRECT_URL="http://127.0.0.1:8081"
AUTHENTIK_ADMIN_EMAILS="admin@example.com,asfd@qqc.co"
EOF
```

### 3. 初始化数据库

```bash
npx prisma db push
npx prisma generate
npx prisma db seed
```

说明：

- `seed` 仍会写入本地测试用户数据
- 这些用户现在主要用于本地角色映射和历史兼容
- 默认登录入口已经不是本地密码页

### 4. 启动 Python 文档生成服务

```bash
cd "/home/z/test-hub/docx-template-system/python-service"
python -m venv ".venv"
".venv/bin/pip" install -r "requirements.txt"
".venv/bin/python" "main.py"
```

### 5. 启动前端开发服务

```bash
cd "/home/z/test-hub/docx-template-system"
npm run dev
```

访问：

- `http://localhost:8060/login`

## 为什么默认不用 Turbopack

当前仓库开发态默认使用：

- `next dev --webpack`
- `next build --webpack`

原因不是功能依赖，而是本地环境稳定性：

- Turbopack 在当前环境下容易碰到 file watcher 限制
- `python-service/.venv` 的符号链接会干扰 Next.js 文件扫描

为避免重复踩坑，当前已经在：

- [`package.json`](/home/z/test-hub/docx-template-system/package.json)
- [`next.config.ts`](/home/z/test-hub/docx-template-system/next.config.ts)

里做了两层收敛：

- 默认使用 `webpack`
- 开发态改用轮询监听，并忽略无关大目录

## 当前开发态性能优化

已做的收敛包括：

- 登录页和 `/api/auth/*` 不再进入全局代理 matcher
- 匿名页不再默认包 `SessionProvider`
- dashboard 首屏复用服务端 `session`，避免重复请求 `/api/auth/session`
- 部分高频 API 改为直接从 JWT 读取路由用户，而不是走 `getServerSession()`

这些改动主要目标是：

- 保证 `http://localhost:8060/` 可稳定访问
- 降低匿名页和 dashboard 首屏的固定开销

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run test
npm run test:run
npx tsc --noEmit
npx prisma db push
npx prisma generate
npx prisma studio
```

## 推荐验证顺序

每次改认证或开发链路后，至少验证：

1. `http://localhost:8060/` 能打开
2. 未登录访问会跳 `/login`
3. `/login` 点击“前往统一登录”能跳 authentik
4. 登录后能回到 dashboard
5. 退出后会离开系统并回统一出口
