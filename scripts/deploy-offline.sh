#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.offline.yml"
ENV_FILE="${PROJECT_ROOT}/.env.offline"
IMAGE_TAR=""

usage() {
  cat <<'EOF'
Offline deploy script

Usage:
  scripts/deploy-offline.sh [--image-tar /path/to/images.tar] [--env-file /path/to/.env.offline]

Examples:
  scripts/deploy-offline.sh
  scripts/deploy-offline.sh --image-tar /tmp/docx-offline-images.tar
  scripts/deploy-offline.sh --env-file /opt/docx/.env.offline
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: required command not found: ${cmd}" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tar)
      IMAGE_TAR="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd "docker"
require_cmd "grep"
require_cmd "curl"

env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf "%s" "${line}"
}

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin is required" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: env file not found: ${ENV_FILE}" >&2
  echo "Hint: cp \"${PROJECT_ROOT}/.env.offline.example\" \"${PROJECT_ROOT}/.env.offline\"" >&2
  exit 1
fi

if [[ -n "${IMAGE_TAR}" ]]; then
  if [[ ! -f "${IMAGE_TAR}" ]]; then
    echo "ERROR: image tar not found: ${IMAGE_TAR}" >&2
    exit 1
  fi
  echo "[1/5] Loading offline images from ${IMAGE_TAR}"
  docker load -i "${IMAGE_TAR}"
else
  echo "[1/5] Skipping image load (--image-tar not provided)"
fi

echo "[2/5] Validating required env keys"
for key in DATABASE_URL NEXTAUTH_SECRET; do
  if ! grep -Eq "^${key}=" "${ENV_FILE}"; then
    echo "ERROR: missing ${key} in ${ENV_FILE}" >&2
    exit 1
  fi
done

DEV_BYPASS_AUTH_VALUE="$(env_value DEV_BYPASS_AUTH)"
NEXT_PUBLIC_DEV_BYPASS_AUTH_VALUE="$(env_value NEXT_PUBLIC_DEV_BYPASS_AUTH)"
if [[ "${DEV_BYPASS_AUTH_VALUE}" != "true" || "${NEXT_PUBLIC_DEV_BYPASS_AUTH_VALUE}" != "true" ]]; then
  for key in AUTHENTIK_ISSUER AUTHENTIK_CLIENT_ID AUTHENTIK_CLIENT_SECRET; do
    if [[ -z "$(env_value "${key}")" ]]; then
      echo "ERROR: ${key} is required when DEV_BYPASS_AUTH is not true" >&2
      exit 1
    fi
  done
fi

echo "[3/5] Starting services"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans

echo "[4/5] Syncing Prisma schema"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --user root app npx prisma db push

APP_PORT="$(grep -E '^APP_PORT=' "${ENV_FILE}" | tail -n1 | cut -d '=' -f2 | tr -d '"' || true)"
if [[ -z "${APP_PORT}" ]]; then
  APP_PORT="8060"
fi

echo "[5/5] Health check: http://127.0.0.1:${APP_PORT}"
if curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null; then
  echo "OK: offline deploy succeeded"
else
  echo "ERROR: app is not responding, printing recent logs..." >&2
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" logs --tail=120 app
  exit 1
fi
