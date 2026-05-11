# 钉钉扫码登录设计

## 背景

在保留 Authentik SSO（便于内网无互联网环境使用）的基础上，新增钉钉扫码登录，提升外网用户体验。参考 `/home/z/scheduling` 项目的钉钉接入实现。

## 需求

- 支持钉钉扫码登录（浏览器打开登录页，钉钉扫码认证）
- 支持钉钉工作台免登（在钉钉工作台内打开应用，自动登录）
- Authentik SSO 保留不变
- 钉钉用户与 Authentik 用户完全独立，不关联
- 所有钉钉登录用户默认为普通用户（USER），管理员只能后台手动设置

## 方案：NextAuth Custom OAuth Provider

在 NextAuth 框架内新增自定义 DingTalk provider，利用 NextAuth 的 OAuth 框架处理整个流程。重写 token 和 profile 回调以适配钉钉非标准 OAuth2 端点。

选择此方案的理由：当前项目深度依赖 NextAuth，在框架内扩展最自然，session/cookie 管理保持统一。

## 数据模型

### User 表新增字段

```prisma
model User {
  // 现有字段
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  password      String?
  oidcSubject   String?   @unique
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // 新增钉钉字段
  dingtalkOpenId   String?   @unique
  dingtalkUnionId  String?
  dingtalkNick     String?
  authProvider     String    @default("local")

  // ... 现有关联关系
}
```

- `authProvider` 值：`local`（开发模式种子）、`oidc`（Authentik）、`dingtalk`（钉钉）
- 钉钉用户的 `email` 自动生成为 `dingtalk_{openId前8位}@dingtalk.local`，保证 unique
- `oidcSubject` 和 `dingtalkOpenId` 各自 `@unique`，互不干扰

## 钉钉工具库

### `src/lib/dingtalk.ts`

封装三个核心 API 调用：

```
buildAuthUrl(state, redirectUri)  → 构建扫码授权 URL
getUserAccessToken(authCode)      → authCode 换 accessToken
getDingtalkUserInfo(accessToken)  → accessToken 换用户信息 (openId, unionId, nick, mobile)
```

钉钉 API 端点：
- 授权页：`https://login.dingtalk.com/oauth2/auth`
- 换 token：`POST https://api.dingtalk.com/v1.0/oauth2/userAccessToken`
- 获取用户：`GET https://api.dingtalk.com/v1.0/contact/users/me`

## NextAuth Custom Provider

### `src/lib/auth-options.ts` 新增 DingTalkProvider

```typescript
DingTalkProvider({
  id: "dingtalk",
  name: "DingTalk",
  type: "oauth",
  authorization: {
    url: "https://login.dingtalk.com/oauth2/auth",
    params: {
      response_type: "code",
      scope: "openid",
      prompt: "consent",
    },
  },
  token: async (params) => {
    // 自定义：用 authCode 换 accessToken（钉钉非标准端点）
    // POST https://api.dingtalk.com/v1.0/oauth2/userAccessToken
    // body: { clientId, clientSecret, code, grantType: "authorization_code" }
    return { access_token: result.accessToken, ... }
  },
  userinfo: {
    url: "https://api.dingtalk.com/v1.0/contact/users/me",
  },
  profile(profile) {
    return {
      id: profile.openId,
      name: profile.nick || "钉钉用户",
      email: `dingtalk_${profile.openId.slice(0, 8)}@dingtalk.local`,
    }
  },
})
```

### signIn 回调逻辑

在现有 `signIn` 回调中增加钉钉分支：
1. 通过 `dingtalkOpenId` 查找用户
2. 找不到则创建新用户（role=USER，authProvider="dingtalk"）
3. 类似现有 `oidc-user-sync.ts` 的模式，独立处理

## 登录页 UI

### `src/app/(auth)/login/login-client.tsx`

通过环境变量 `NEXT_PUBLIC_DINGTALK_ENABLED`（由 `DINGTALK_CLIENT_ID` 是否存在推导）控制钉钉按钮显示。

```
┌─────────────────────────────┐
│        系统标题 v0.x.x       │
│                             │
│   [前往统一登录 (Authentik)]  │  ← 现有，仅生产环境
│                             │
│   [钉钉扫码登录]             │  ← 新增，仅配置了钉钉时显示
│                             │
│   ── 或 ──                  │
│   快捷登录: admin / user     │  ← 现有，仅开发模式
└─────────────────────────────┘
```

钉钉按钮点击后触发 `signIn("dingtalk")`，NextAuth 自动跳转到钉钉授权页。退出登录时钉钉用户只需清除本地 session。

## 工作台免登

### 页面 `src/app/dingtalk/page.tsx`

- 检测 `NEXT_PUBLIC_DINGTALK_CORP_ID` 环境变量
- 在钉钉环境：加载钉钉 JS SDK → `requestAuthCode` 获取 authCode → POST 到 workbench API
- 不在钉钉环境：回退到 OAuth 跳转流程（`signIn("dingtalk")`）

### API 路由 `src/app/api/auth/dingtalk/workbench/route.ts`

- 接收前端传来的 authCode
- 调用 `getUserAccessToken` + `getDingtalkUserInfo` 获取用户信息
- 查找或创建用户
- 签发 NextAuth JWT session（直接操作 JWT，绕过标准 OAuth 流程）

## 环境变量

```env
# 钉钉 OAuth（必填，有值则启用钉钉登录）
DINGTALK_CLIENT_ID=dingtiesk0cqjtvgsmcd
DINGTALK_CLIENT_SECRET=iCxw9Iz9W1iHvCDZGKJWnLz7rNOGi7ilqZEuLaXZzvqxkVe2cEfQg8HFeO8garHs

# 钉钉工作台免登（可选，有值则启用免登）
NEXT_PUBLIC_DINGTALK_CORP_ID=
```

## 路由保护

### `src/proxy.ts`

新增放行 `/dingtalk` 路径，使未登录用户可访问工作台免登页面。

钉钉 OAuth 回调走 NextAuth 的 `/api/auth/callback/dingtalk`，已在现有 matcher 放行范围内（`/api/auth/` 前缀）。工作台免登 API `/api/auth/dingtalk/workbench` 也在放行范围内。

## 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `prisma/schema.prisma` | 新增 dingtalkOpenId, dingtalkUnionId, dingtalkNick, authProvider |
| 修改 | `src/lib/auth-options.ts` | 新增 DingTalkProvider + signIn 回调分支 |
| 修改 | `src/lib/auth.ts` | 扩展类型定义 |
| 修改 | `src/app/(auth)/login/login-client.tsx` | 新增钉钉登录按钮 |
| 修改 | `src/proxy.ts` | 放行 `/dingtalk` 路径 |
| 新增 | `src/lib/dingtalk.ts` | 钉钉 API 工具库 |
| 新增 | `src/app/dingtalk/page.tsx` | 工作台免登页面 |
| 新增 | `src/app/api/auth/dingtalk/workbench/route.ts` | 工作台免登 API |
