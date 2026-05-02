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
