# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server on port 8060
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx prisma db push   # Push schema changes to DB (no migration files)
npx prisma generate  # Regenerate Prisma client
npx prisma db seed   # Seed admin + user accounts
npx prisma studio    # Database GUI
npm run release      # Bump patch version + CHANGELOG + git tag
npm run release:minor # Bump minor version
npm run release:major # Bump major version
```

## Architecture

Template-driven office automation system: users upload .docx templates with `{{ placeholder }}` tokens, configure them, then fill dynamic forms to generate documents.

**Three-layer backend pattern:**
- `src/types/` — TypeScript interfaces (TemplateListItem, PlaceholderItem, RecordDetail, etc.)
- `src/validators/` — Zod schemas for API input validation
- `src/lib/services/` — Business logic, all functions return `ServiceResult<T>` (`{ success: true, data } | { success: false, error: { code, message } }`)
- `src/app/api/` — Route Handlers are thin wrappers that validate input, check auth/permissions, then delegate to services

**Route groups:** `(auth)` for login (no sidebar), `(dashboard)` for main app (sidebar + header).

## Critical Version Differences

### Next.js v16
- `src/proxy.ts` replaces `middleware.ts` — use `export async function proxy()` and `export const config = { matcher: [...] }`
- Dynamic route params are Promises: `{ params }: { params: Promise<{ id: string }> }` — always `await params`
- `searchParams` in page props are also Promises

### Prisma v7
- **Driver adapter required:** `new PrismaClient({ adapter: new PrismaPg(pool) })` — never bare `new PrismaClient()`
- Import client: `import { PrismaClient } from "@/generated/prisma/client"` (not `@prisma/client`)
- Import enums: `import { Role, TemplateStatus } from "@/generated/prisma/enums"`
- DB URL configured in `prisma.config.ts` (not in schema.prisma or .env)
- Use `prisma db push` for schema changes (not migrations for this project)

### shadcn/ui v4 (Base UI)
- Built on `@base-ui/react`, not Radix
- Button: use `render` prop instead of `asChild` — `render={<Link href="..." />}`
- DropdownMenu: uses `render` prop pattern, not `forceMount`
- No separate toast component — use `sonner` directly: `import { toast } from "sonner"`

## Auth

NextAuth v4 with JWT strategy. Session includes `user.id` and `user.role`.

```typescript
// Server Component / Route Handler
import { auth } from "@/lib/auth";
const session = await auth(); // session.user.id, session.user.role

// Client Component
import { useSession, signOut } from "next-auth/react";
```

### 开发模式绕过认证

设置 `DEV_BYPASS_AUTH=true` 和 `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` 后，登录页显示管理员/普通用户快捷登录按钮，无需启动 Authentik。使用种子用户账号（`npx prisma db seed` 初始化）：

- 管理员：`admin@example.com` / `admin123`
- 普通用户：`user@example.com` / `user123`

Route protection is in `src/proxy.ts`. All routes except `/login` and `/api/auth` require authentication.

## GitHub Issue Workflow

处理 GitHub issue 时需要创建并切换到相应分支。

```bash
# 查看 issue
gh issue view <id>

# 创建分支并处理
git checkout -b feature/issue-<id>-<描述>
# 完成开发后
git push -u origin feature/issue-<id>-<描述>
# 创建 PR 并关联 issue
gh pr create --title "[Feature] ..." --body "$(cat <<'EOF'
## Summary
<描述>

## Test plan
- [ ] 测试功能

Closes #<issue-id>
EOF
)"
```

**PR 创建要求：**
- 标题以 `[Feature]` 或 `[Fix]` 等前缀开头
- Body 中使用 `Closes #<issue-id>` 关联 issue，合并 PR 时自动关闭

当前处理的 issue:
- #12: 模型管理标签页配置（管理员设置页面）

## Key Patterns

**File uploads:** `src/lib/file.service.ts` handles save/copy/delete. Uploaded files go to `public/uploads/{templates|documents}/`. The `UPLOAD_DIR` env var controls the base path.

**Docx parsing:** `src/lib/docx-parser.ts` uses JSZip to unzip, merges XML `<w:r>/<w:t>` runs within `<w:p>` paragraphs (Word splits `{{ key }}` across runs), then regex extracts `{{\w+}}` keys.

**DB access:** Import `db` from `@/lib/db` — it's a singleton with driver adapter already configured.

**Authentik 浏览器登录:** 用户名 `akadmin`，密码 `idrl123456`

## Python Service

Lightweight FastAPI service for docx placeholder replacement. Located at `python-service/`.

```bash
cd python-service && .venv/bin/python main.py   # Start on port 8065
```

- **Port:** 8065
- **Endpoints:** `GET /health`, `POST /generate` (template_path, output_filename, form_data)
- **Dependency:** `python-docx` — replaces `{{ key }}` in paragraphs and tables
- **Configured via:** `PYTHON_SERVICE_URL` env var (default `http://localhost:8065`)

## Version Management

使用 `commit-and-tag-version` 管理版本（基于 conventional commits 自动 bump + CHANGELOG + git tag）。版本号显示在登录页和侧边栏。

```bash
npm run release           # patch bump + CHANGELOG + commit + tag
npm run release:minor     # minor bump
npm run release:major     # major bump
git push --follow-tags    # 推送代码和 tag
```
