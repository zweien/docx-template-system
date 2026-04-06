# Version Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unified version management with `commit-and-tag-version`, display version on login page and sidebar.

**Architecture:** Inject `package.json` version into Next.js build via `NEXT_PUBLIC_APP_VERSION` env var. Display in login page CardContent and sidebar footer. Use `commit-and-tag-version` CLI for release workflow.

**Tech Stack:** commit-and-tag-version, Next.js env injection, React components

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add `commit-and-tag-version` devDep + release scripts |
| `next.config.ts` | Modify | Inject `NEXT_PUBLIC_APP_VERSION` from package.json |
| `src/app/(auth)/login/page.tsx` | Modify | Add version text below login button |
| `src/components/layout/sidebar.tsx` | Modify | Add version text between nav and footer |

---

### Task 1: Install commit-and-tag-version and add release scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run:
```bash
npm install --save-dev commit-and-tag-version
```

Expected: `commit-and-tag-version` appears in `package.json` devDependencies.

- [ ] **Step 2: Add release scripts to package.json**

Add these scripts to `package.json` `"scripts"` section:

```json
"release": "commit-and-tag-version",
"release:minor": "commit-and-tag-version --release-as minor",
"release:major": "commit-and-tag-version --release-as major"
```

- [ ] **Step 3: Verify scripts are registered**

Run: `npm run release -- --help`
Expected: Prints `commit-and-tag-version` help output (shows it's installed and callable).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add commit-and-tag-version for release management"
```

---

### Task 2: Inject version into Next.js build

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Modify next.config.ts to inject version**

The current `next.config.ts` is:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack 模式下 webpack 配置不生效
};

export default nextConfig;
```

Change to:
```ts
import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build works**

Run: `npm run build`
Expected: Build completes without errors. The `NEXT_PUBLIC_APP_VERSION` env var is now injected.

- [ ] **Step 3: Verify version is available at runtime**

Start the dev server and check the version is accessible. In a component or page, `process.env.NEXT_PUBLIC_APP_VERSION` should return `"0.1.0"`.

Run: `npm run dev`
Then verify in browser console: should show `"0.1.0"`.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: inject NEXT_PUBLIC_APP_VERSION from package.json"
```

---

### Task 3: Display version on login page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx:62-71`

- [ ] **Step 1: Add version display in CardContent**

The current `CardContent` section (lines 62-71):
```tsx
<CardContent>
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      登录认证由统一认证中心负责，系统内部权限继续按本地角色控制。
    </p>
    <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
      {isLoading ? "跳转中..." : "前往统一登录"}
    </Button>
  </div>
</CardContent>
```

Add version text after the `</div>` but inside `CardContent`:
```tsx
<CardContent>
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      登录认证由统一认证中心负责，系统内部权限继续按本地角色控制。
    </p>
    <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
      {isLoading ? "跳转中..." : "前往统一登录"}
    </Button>
  </div>
  <p className="mt-4 text-center text-xs text-muted-foreground">
    v{process.env.NEXT_PUBLIC_APP_VERSION}
  </p>
</CardContent>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, navigate to `/login`.
Expected: Version string `v0.1.0` appears below the login button, centered, small muted text.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat: display version on login page"
```

---

### Task 4: Display version in sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx:222-224`

- [ ] **Step 1: Add version display between nav and footer**

The current code at the boundary (lines 222-225):
```tsx
      </nav>

      {/* Footer: collapse button + user nav */}
      <div className="border-t border-zinc-800 shrink-0">
```

Insert version div between `</nav>` and the footer comment:
```tsx
      </nav>

      {/* Version */}
      <div className="px-3 py-2 text-xs text-zinc-500 shrink-0">
        {!collapsed ? `IDRL填表系统 ` : ``}v{process.env.NEXT_PUBLIC_APP_VERSION}
      </div>

      {/* Footer: collapse button + user nav */}
      <div className="border-t border-zinc-800 shrink-0">
```

Note: Using `text-zinc-500` instead of `text-muted-foreground` to match the sidebar's dark zinc-950 background. Muted-foreground may not render well on the dark sidebar.

- [ ] **Step 2: Verify visually in both states**

Run: `npm run dev`, navigate to dashboard.
- Expanded sidebar: should show `IDRL填表系统 v0.1.0` between nav and footer
- Click collapse button: should show `v0.1.0` centered in narrow sidebar
- Version text should be small, muted, not visually prominent

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: display version in sidebar footer"
```

---

### Task 5: Verify end-to-end release workflow

**Files:**
- None (verification only)

- [ ] **Step 1: Verify full build works with all changes**

Run: `npm run build`
Expected: Build completes successfully with no errors.

- [ ] **Step 2: Verify release dry-run**

Run: `npx commit-and-tag-version --dry-run`
Expected: Shows what would happen (version bump, changelog, tag) without actually doing anything. Output should reference current version `0.1.0`.

- [ ] **Step 3: Commit any remaining changes**

If there are any uncommitted changes, commit them. Otherwise skip.
