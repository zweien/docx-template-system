#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Budget Report Desktop — Full Build ==="
echo "App dir: $APP_DIR"

# Step 1: Build sidecar
echo ""
echo "[1/3] Building Python sidecar..."
bash "$SCRIPT_DIR/build-sidecar.sh"

# Step 2: Build frontend
echo ""
echo "[2/3] Building frontend..."
cd "$APP_DIR"
npm run build

# Step 3: Build Tauri bundle
echo ""
echo "[3/3] Building Tauri bundle..."
cd "$APP_DIR"
npm run tauri build

echo ""
echo "=== Build complete ==="
ls -la "$APP_DIR/src-tauri/target/release/bundle/"
