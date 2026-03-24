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

NextAuth v4 Credentials Provider with JWT strategy. Session includes `user.id` and `user.role`.

```typescript
// Server Component / Route Handler
import { auth } from "@/lib/auth";
const session = await auth(); // session.user.id, session.user.role

// Client Component
import { useSession, signOut } from "next-auth/react";
```

Route protection is in `src/proxy.ts`. All routes except `/login` and `/api/auth` require authentication.

## Key Patterns

**File uploads:** `src/lib/file.service.ts` handles save/copy/delete. Uploaded files go to `public/uploads/{templates|documents}/`. The `UPLOAD_DIR` env var controls the base path.

**Docx parsing:** `src/lib/docx-parser.ts` uses JSZip to unzip, merges XML `<w:r>/<w:t>` runs within `<w:p>` paragraphs (Word splits `{{ key }}` across runs), then regex extracts `{{\w+}}` keys.

**DB access:** Import `db` from `@/lib/db` — it's a singleton with driver adapter already configured.

**Test accounts:** admin@example.com / admin123 (ADMIN), user@example.com / user123 (USER)

## Python Service

Lightweight FastAPI service for docx placeholder replacement. Located at `python-service/`.

```bash
cd python-service && .venv/bin/python main.py   # Start on port 8065
```

- **Port:** 8065
- **Endpoints:** `GET /health`, `POST /generate` (template_path, output_filename, form_data)
- **Dependency:** `python-docx` — replaces `{{ key }}` in paragraphs and tables
- **Configured via:** `PYTHON_SERVICE_URL` env var (default `http://localhost:8065`)
