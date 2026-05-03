#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SIDECAR_DIR="$(cd "$SCRIPT_DIR/../sidecar" && pwd)"
BUILD_DIR="$SCRIPT_DIR/../src-tauri/sidecar"

echo "=== Building sidecar with PyInstaller ==="
echo "Sidecar source: $SIDECAR_DIR"
echo "Output: $BUILD_DIR"

# Install PyInstaller if not present
pip install pyinstaller --quiet 2>/dev/null || pip3 install pyinstaller --quiet 2>/dev/null

# Clean previous build
rm -rf "$BUILD_DIR"

# 同步 report_engine 从主项目（确保 Desktop 用最新代码）
echo "Syncing report_engine from main project..."
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
rm -rf "$SIDECAR_DIR/report_engine"
cp -r "$REPO_ROOT/report-engine/src/report_engine" "$SIDECAR_DIR/report_engine"
echo "Synced report_engine (including budget module)"

# Build
cd "$SIDECAR_DIR"
pyinstaller \
    --name budget-sidecar \
    --onedir \
    --clean \
    --noconfirm \
    --distpath "$BUILD_DIR" \
    --workpath /tmp/sidecar-build-work \
    --specpath /tmp/sidecar-build-work \
    --add-data "api:api" \
    --add-data "scripts:scripts" \
    --add-data "report_engine:report_engine" \
    --hidden-import report_engine \
    --hidden-import report_engine.blocks \
    --hidden-import report_engine.renderer \
    --hidden-import report_engine.subdoc \
    --hidden-import report_engine.template_parser \
    --hidden-import report_engine.converter \
    --hidden-import report_engine.prompt_parser \
    --hidden-import report_engine.schema \
    --hidden-import report_engine.budget \
    --hidden-import report_engine.budget.parse_excel \
    --hidden-import report_engine.budget.validate_excel \
    --hidden-import report_engine.budget.build_payload \
    --hidden-import report_engine.budget.models \
    --hidden-import docxtpl \
    --hidden-import docx \
    --hidden-import openpyxl \
    --hidden-import latex2mathml \
    --hidden-import yaml \
    --collect-data docxtpl \
    main.py

echo ""
echo "=== Sidecar build complete ==="
ls -la "$BUILD_DIR/budget-sidecar/"
echo ""
echo "Binary: $BUILD_DIR/budget-sidecar/budget-sidecar"
