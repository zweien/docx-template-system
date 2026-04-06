# GitHub Actions VPS 部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up GitHub Actions to auto-deploy to VPS on tag push, using Docker Compose with shared PostgreSQL.

**Architecture:** Next.js standalone Docker build + Python service, connected to existing PostgreSQL via `deploy_sso_net` network. GitHub Actions SSHes to VPS on tag push to git pull, rebuild, and restart.

**Tech Stack:** Docker multi-stage build, docker-compose, GitHub Actions SSH deployment

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `next.config.ts` | Modify | Add `output: 'standalone'` for Docker standalone output |
| `Dockerfile` | Create | Next.js multi-stage build (deps → build → runner) |
| `.dockerignore` | Create | Exclude node_modules, .next, uploads from Docker context |
| `docker-compose.yml` | Create | Define app + python-service containers, volumes, networks |
| `.github/workflows/deploy.yml` | Create | Tag-triggered SSH deployment workflow |

---

### Task 1: Enable Next.js standalone output mode

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add `output: 'standalone'` to next.config.ts**

Current file:
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

Change to:
```ts
import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build still works locally**

Run: `npm run build`
Expected: Build succeeds. Check that `.next/standalone/` directory is created with `server.js` inside.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable Next.js standalone output for Docker deployment"
```

---

### Task 2: Create Dockerfile for Next.js app

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy Prisma generated client (standalone trace may not include all files)
COPY --from=builder /app/src/generated ./src/generated
# Copy prisma schema for db push at runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# node_modules needed for prisma db push at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 8060
ENV PORT=8060
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Note: `node_modules` and `package.json` are copied to the runner stage because we need `npx prisma db push` at deployment time. This increases image size but keeps deployment simple. The standalone output's own minimal `node_modules` is overwritten, but that's acceptable since the full set is needed for Prisma CLI.

Note: `prisma.config.ts` reads `.env.local` via dotenv, but in Docker, `.env.local` doesn't exist. This is fine because `dotenv.config()` doesn't overwrite existing env vars, and `docker-compose.yml` provides `DATABASE_URL` via `env_file: .env.production`. `prisma db push` will use the env var directly.

- [ ] **Step 2: Verify Docker build succeeds**

Run: `docker build -t docx-app-test .`
Expected: Build completes without errors. Image size should be reasonable (under 1GB).

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile for Next.js standalone build"
```

---

### Task 3: Create .dockerignore

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
.next
.git
.gitignore
.claude
.env
.env.local
.env.production
*.md
docs/
scripts/
public/uploads/*
!.gitkeep
.DS_Store
*.tsbuildinfo
```

This excludes:
- `node_modules` (rebuilt via `npm ci` in Docker)
- `.next` (rebuilt via `next build` in Docker)
- Upload files (managed via Docker volumes, not baked into image)
- Dev files (docs, scripts, .claude)

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "feat: add .dockerignore for Docker build"
```

---

### Task 4: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "127.0.0.1:8060:8060"
    env_file: .env.production
    environment:
      - PYTHON_SERVICE_URL=http://python-service:8065
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads
      - collection-uploads:/app/.data/uploads
    networks:
      - default
      - sso_net

  python-service:
    build: ./python-service
    environment:
      - PORT=8065
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads:ro

volumes:
  uploads:
  collection-uploads:

networks:
  sso_net:
    external: true
    name: deploy_sso_net
```

- [ ] **Step 2: Verify config is valid**

Run: `docker compose config`
Expected: Outputs parsed YAML without errors. Both services, volumes, and networks are defined.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for production deployment"
```

---

### Task 5: Create GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Deploy to VPS

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        env:
          TAG_NAME: ${{ github.ref_name }}
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          envs: TAG_NAME
          script: |
            set -e
            echo "Deploying tag: $TAG_NAME"

            cd /opt/docx-template-system

            # Pull latest code
            git fetch --tags
            git checkout "$TAG_NAME"

            # Rebuild and deploy
            docker compose build
            docker compose run --rm --user root app npx prisma db push
            docker compose up -d --remove-orphans

            # Health check
            echo "Waiting for service to start..."
            sleep 15
            if curl -sf http://127.0.0.1:8060 > /dev/null; then
              echo "✅ Deploy successful - service is running"
            else
              echo "❌ Deploy failed - service not responding"
              docker compose logs --tail=50 app
              exit 1
            fi
```

Note: `TAG_NAME` is passed via `envs` parameter so the VPS can access it. `prisma db push` runs with `--user root` to avoid file permission issues since the Dockerfile sets `USER nextjs`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow"
```

---

### Task 6: Verify Docker build locally

**Files:** None (verification only)

- [ ] **Step 1: Full docker compose build test**

Run: `docker compose build`
Expected: Both `app` and `python-service` build without errors.

- [ ] **Step 2: Verify standalone output exists in image**

Run: `docker run --rm docx-template-system-app ls -la /app/server.js /app/.next/static /app/public /app/prisma`
Expected: All paths exist in the image.

- [ ] **Step 3: Commit any fixes if needed**

If the build revealed issues (e.g., missing files, wrong paths), fix them and commit.

---

### Task 7: Push and verify workflow

**Files:** None (push and verify)

- [ ] **Step 1: Push all commits to remote**

```bash
git push origin master
```

- [ ] **Step 2: Create a tag to trigger deployment**

```bash
npm run release
git push --follow-tags
```

- [ ] **Step 3: Monitor GitHub Actions**

Check `https://github.com/zweien/docx-template-system/actions` to verify the deploy workflow runs.

- [ ] **Step 4: Verify VPS service**

After deployment completes, visit `https://doc.idrl.top` and confirm the app loads.
