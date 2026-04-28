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
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ARG AUTHENTIK_ISSUER="placeholder"
ARG AUTHENTIK_CLIENT_ID="placeholder"
ARG AUTHENTIK_CLIENT_SECRET="placeholder"
ARG AUTHENTIK_LOGOUT_REDIRECT_URL="https://placeholder.example.com"
ARG AUTHENTIK_ADMIN_EMAILS="admin@example.com"
ARG AI_API_KEY="placeholder"
ARG AI_BASE_URL="http://placeholder:3000/v1"
ARG AI_MODEL="placeholder"
ARG MODEL_CONFIG_ENCRYPTION_KEY="placeholder"
ENV AUTHENTIK_ISSUER=${AUTHENTIK_ISSUER} \
    AUTHENTIK_CLIENT_ID=${AUTHENTIK_CLIENT_ID} \
    AUTHENTIK_CLIENT_SECRET=${AUTHENTIK_CLIENT_SECRET} \
    AUTHENTIK_LOGOUT_REDIRECT_URL=${AUTHENTIK_LOGOUT_REDIRECT_URL} \
    AUTHENTIK_ADMIN_EMAILS=${AUTHENTIK_ADMIN_EMAILS} \
    AI_API_KEY=${AI_API_KEY} \
    AI_BASE_URL=${AI_BASE_URL} \
    AI_MODEL=${AI_MODEL} \
    MODEL_CONFIG_ENCRYPTION_KEY=${MODEL_CONFIG_ENCRYPTION_KEY}
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
COPY --from=builder /app/y-websocket-server ./y-websocket-server

RUN apk add --no-cache su-exec

# Create upload directories with correct ownership
RUN mkdir -p .data/uploads .data/backups y-websocket-db && chown nextjs:nodejs .data/uploads .data/backups y-websocket-db

# Entrypoint fixes volume ownership at runtime (runs as root, drops to nextjs)
COPY --chmod=755 <<'EOF' /app/entrypoint.sh
#!/bin/sh
# Fix ownership of volume-mounted directories at runtime
# (Docker named volumes may retain root ownership from initial creation)
chown -R nextjs:nodejs /app/.data/uploads /app/.data/backups 2>/dev/null || true
chown -R nextjs:nodejs /app/public/uploads 2>/dev/null || true
chown -R nextjs:nodejs /app/y-websocket-db 2>/dev/null || true
exec su-exec nextjs "$@"
EOF

EXPOSE 8060
ENV PORT=8060
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
