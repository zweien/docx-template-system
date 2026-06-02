# NocoDB API 路由权限控制设计

## 背景

docx-template-system 已集成 NocoDB 社区版作为主数据表后端。所有 NocoDB API 调用通过服务器端 API 路由转发，使用管理员 xc-token 认证。当前所有已登录用户均可执行全部 CRUD 操作，缺少角色权限控制。

NocoDB 社区版不支持 OIDC/SAML SSO，无法与 Authentik 统一认证集成，因此需要在应用层控制权限。

## 目标

在现有 NocoDB API 路由中添加基于角色的访问控制，使 ADMIN 可执行所有操作，USER 仅能读取数据。

## 权限矩阵

| 操作 | HTTP 方法 | 路由 | ADMIN | USER |
|------|-----------|------|-------|------|
| 健康检查 | GET | /api/nocodb/health | ✅ | ✅ |
| 列出表 | GET | /api/nocodb/tables | ✅ | ✅ |
| 表详情 | GET | /api/nocodb/tables/[tableId] | ✅ | ✅ |
| 查询记录 | GET | /api/nocodb/tables/[tableId]/records | ✅ | ✅ |
| 创建记录 | POST | /api/nocodb/tables/[tableId]/records | ✅ | ❌ |
| 更新记录 | PATCH | /api/nocodb/tables/[tableId]/records | ✅ | ❌ |
| 删除记录 | DELETE | /api/nocodb/tables/[tableId]/records | ✅ | ❌ |

**不受影响的路径：**
- `/data` iframe 页面：所有登录用户可见（shared base viewer 模式已是只读）
- 模板填写/批量生成时的数据查询：走 GET 记录路由，所有用户可用

## 实现方案

在 API 路由层添加角色检查，复用项目已有的 `session.user.role` 模式：

```typescript
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}
// 写操作额外检查
if (session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "权限不足，仅管理员可执行此操作" }, { status: 403 });
}
```

### 改动文件

仅 `src/app/api/nocodb/tables/[tableId]/records/route.ts` 一个文件，在 POST、PATCH、DELETE handler 中添加 ADMIN 角色检查。

### 不改动的文件

- `src/app/api/nocodb/health/route.ts` — 无认证，无需改动
- `src/app/api/nocodb/tables/route.ts` — 读操作，无需改动
- `src/app/api/nocodb/tables/[tableId]/route.ts` — 读操作，无需改动
- `src/app/(dashboard)/data/page.tsx` — iframe 已是 viewer 只读模式
- `src/lib/nocodb/*` — 服务层不涉及 HTTP 请求上下文

### 错误响应

权限不足时统一返回 HTTP 403：

```json
{ "error": "权限不足，仅管理员可执行此操作" }
```

## 不做的事情

- 不引入新的权限抽象或中间件
- 不修改 NocoDB 服务层代码
- 不在 proxy.ts 中加路由过滤
- 不实现表级别的细粒度权限
