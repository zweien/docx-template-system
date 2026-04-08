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
- `http://localhost:8060/login/ui-check`

## 开发服务器

仓库使用 Next.js 16 默认的 Turbopack：

- `next dev -p 8060` (Turbopack)
- `next build` (Turbopack)

`npm run dev` 和 `npm run build` 命令已配置为使用 Turbopack。

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

## UI Smoke Page

仓库内保留了一个公开样式验证页：

- `http://localhost:8060/login/ui-check`

用途：

- 快速检查 `Select`、`Popover`、`DropdownMenu` 的弹层背景是否正常
- 快速检查容器边框、卡片背景、弹层前景色是否仍然绑定到语义 token
- 排查“整体框体透明”这类全局主题回归

适用场景：

- 改了 `src/app/tokens.css`
- 改了 `src/components/ui/*`
- 升级了 Tailwind、shadcn、Base UI
- 怀疑是全局样式或 token 退化，不确定是不是业务页单独写坏

建议最少看这几项：

1. 页面外层卡片是否为白底
2. 卡片边框是否可见
3. Select 下拉层是否为白底深字
4. Popover 和 DropdownMenu 弹层是否会透出背景文字

## 选项模板说明

当前单选 / 多选模板支持两类写法：

1. 显式控制行语法

```text
{{选项:性别|single}}
□ 男
□ 女
```

2. Word 原生内联勾选写法

```text
{{选项:单项|single}}
单项：☑是 ☐否

{{选项:多选|multiple}}
多选：☐选项1 ☑选项2 ☑选项3 ☐选项4
```

第二类在 docx XML 里通常不是普通 `□` 字符，而是 `w:sym` + `Wingdings 2` 符号。当前实现已经兼容这种结构，但单选 / 多选类型必须由前置控制行显式声明，不再从“单项 / 多选”这类标题文字推断。

### 真实模板兼容说明

真实 Word 模板里，选项文本可能被拆成多个连续 run，例如：

- `选项`
- `1`

当前解析器会把这类连续文本重新拼成完整标签，例如 `选项1`。

### 运行态注意事项

如果你修改了下面两处代码，必须分别重启对应服务，才能看到最新行为：

- `src/lib/docx-parser.ts`
- `python-service/main.py`

否则会出现“源码已经更新，但上传解析或生成结果还是旧逻辑”的现象。
