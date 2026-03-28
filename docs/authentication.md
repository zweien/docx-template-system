# 认证接入说明

## 目标

当前项目已经从本地账号密码登录切换为 `authentik + OIDC`。

设计边界如下：

- `authentik` 负责认证
- 本系统负责本地 Session 和业务权限
- 本地 `User.role` 继续作为页面和 API 授权依据

这意味着：

- 用户通过统一认证登录
- 首次登录时，本系统会把 OIDC 用户映射到本地 `User`
- 后续所有权限判断仍看本地 `role`

## 当前实现

关键文件：

- [`src/lib/auth-options.ts`](/home/z/test-hub/docx-template-system/src/lib/auth-options.ts)
- [`src/lib/oidc-user-sync.ts`](/home/z/test-hub/docx-template-system/src/lib/oidc-user-sync.ts)
- [`src/app/(auth)/login/page.tsx`](/home/z/test-hub/docx-template-system/src/app/(auth)/login/page.tsx)
- [`src/components/layout/user-nav.tsx`](/home/z/test-hub/docx-template-system/src/components/layout/user-nav.tsx)

核心流程：

1. 用户访问受保护页面
2. `src/proxy.ts` 检查 JWT，没有登录则跳 `/login`
3. 登录页调用 `signIn("authentik")`
4. authentik 登录成功后回调 `/api/auth/callback/authentik`
5. NextAuth `jwt` callback 中执行本地用户同步
6. 系统把本地 `id`、`role`、`email` 写入 JWT Session
7. 页面和 API 用本地 Session 继续做授权

## 本地用户同步规则

当前同步逻辑是：

1. 先按 `oidcSubject` 查本地用户
2. 未命中时，再按邮箱查找现有本地用户
3. 如果邮箱命中，则认领该账号并写入 `oidcSubject`
4. 如果都未命中，则自动创建本地用户

默认角色规则：

- 邮箱在 `AUTHENTIK_ADMIN_EMAILS` 列表中，首次登录创建或认领为 `ADMIN`
- 其它用户默认创建为 `USER`

相关字段：

- `User.oidcSubject`
- `User.email`
- `User.role`

## authentik 后台配置

当前项目对应的 authentik 配置要点：

- 应用名：`文档模板系统`
- Provider：`docx-template-system-provider`
- Launch URL：`http://localhost:8060`
- Redirect URI：`http://localhost:8060/api/auth/callback/authentik`

如果需要重建该配置，请在 authentik 后台执行：

1. `Applications -> Providers -> Create`
2. 选择 `OAuth2/OpenID Provider`
3. `Client type` 选 `Confidential`
4. `Redirect URIs/Origins` 填：
   - `http://localhost:8060/api/auth/callback/authentik`
5. 创建后复制：
   - `Client ID`
   - `Client Secret`
6. 再创建 `Application`
7. `Launch URL` 填：
   - `http://localhost:8060`

## .env.local 配置

最小配置如下：

```env
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
```

说明：

- `AUTHENTIK_ISSUER` 必须和 authentik 应用的 issuer 一致
- `AUTHENTIK_CLIENT_SECRET` 只放服务端环境变量，不能进前端代码
- `AUTHENTIK_LOGOUT_REDIRECT_URL` 当前建议回门户

## 退出登录

退出流程不是只清本地 Session。

当前实现：

1. 前端先请求 `/api/auth/sso-logout-url`
2. 服务端基于 `id_token` 生成 authentik 退出地址
3. 前端执行 `signOut({ redirect: false })`
4. 浏览器再跳转到 authentik 退出地址

这样做的原因是：

- 只清本地 Session 会导致 authentik SSO 仍然存在
- 用户再次进入系统时会自动登录

## 用户管理变化

统一认证接入后，“用户管理”页只负责本地业务用户映射，不再负责本地密码。

当前可以管理：

- 姓名
- 邮箱
- 角色
- 是否已绑定统一登录

当前不再管理：

- 本地密码
- 本地登录入口

## 迁移注意点

虽然系统已切到统一认证，但数据库里仍保留 `User.password` 字段，原因是：

- 这是兼容历史数据的过渡方案
- 当前代码不再使用该字段做登录校验
- 后续如果确认完全不再回退到本地密码登录，可以再单独移除
