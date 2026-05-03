# 预算报告 Web 集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Desktop 预算报告功能集成到 Web 端，Python 代码统一到 report-engine，Web 前端新建 /budget 向导页。

**Architecture:** report-engine 新增 `budget/` 模块（从 sidecar 迁入 3 个脚本）+ 3 个 HTTP 端点。Web 前端直连 report-engine，3 步向导（选模板+配置 → 上传 Excel → 预览生成）。Desktop 构建脚本自动同步 report_engine 代码。

**Tech Stack:** Python/FastAPI (report-engine), Next.js 16 + React + shadcn/ui (前端), openpyxl (Excel 解析)

---

## File Structure

### report-engine (Python)

```
report-engine/
├── main.py                              # MODIFY: 新增 3 个 budget 端点
├── requirements.txt                      # 已有 openpyxl，无需修改
└── src/report_engine/
    └── budget/                           # NEW: 整个目录
        ├── __init__.py                   # 导出关键函数
        ├── models.py                     # Pydantic 模型
        ├── parse_excel.py                # 从 sidecar/scripts/parse_excel_budget.py 迁入
        ├── validate_excel.py             # 从 sidecar/api/validate_excel.py 迁入
        └── build_payload.py              # 从 sidecar/scripts/build_payload.py 迁入
```

### Web 前端 (Next.js)

```
src/
├── app/(dashboard)/budget/
│   └── page.tsx                          # NEW: 预算报告向导页
├── components/layout/navigation/
│   └── schema.ts                         # MODIFY: 添加预算报告导航项
├── lib/
│   └── budget-report-client.ts           # NEW: report-engine budget API 客户端
public/
├── budget-templates/
│   └── budget_report.docx                # NEW: 从 templates/ 拷贝
└── budget-configs/
    └── default.json                      # NEW: 从 desktop samples 拷贝
```

### Desktop 适配

```
apps/desktop/
├── scripts/build-sidecar.sh              # MODIFY: 自动同步 report_engine
└── sidecar/
    ├── main.py                           # MODIFY: 更新 sys.path 和 import
    └── api/
        ├── parse.py                      # MODIFY: 从 report_engine.budget 导入
        ├── render.py                     # MODIFY: 从 report_engine.budget 导入
        └── validate_excel.py             # MODIFY: 从 report_engine.budget 导入
```

---

## Phase 1: report-engine 后端

### Task 1: 创建 budget 模块目录和 models.py

**Files:**
- Create: `report-engine/src/report_engine/budget/__init__.py`
- Create: `report-engine/src/report_engine/budget/models.py`

- [ ] **Step 1: 创建 `__init__.py`**

```python
"""预算报告解析、校验、渲染模块。"""

from report_engine.budget.parse_excel import parse_excel_budget
from report_engine.budget.validate_excel import validate_excel_data
from report_engine.budget.build_payload import build_payload

__all__ = ["parse_excel_budget", "validate_excel_data", "build_payload"]
```

- [ ] **Step 2: 创建 `models.py`**

从 sidecar 各文件中提取 Pydantic 模型，统一放在此处：

```python
"""预算报告相关 Pydantic 模型。"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ── 校验相关 ──


class SheetResult(BaseModel):
    sheet_name: str
    found: bool
    missing_columns: list[str] = []
    extra_columns: list[str] = []
    total_rows: int = 0
    empty_cells: list[dict] = []
    fill_rate: float = 0.0
    numeric_violations: list[dict] = []
    unique_values: dict[str, list[str]] = {}
    image_summary: Optional[dict] = None
    warnings: list[str] = []


class SummaryResult(BaseModel):
    sheet_name: str
    found: bool
    mode: str
    key_column_found: Optional[bool] = None
    value_column_found: Optional[bool] = None
    mapped_count: int = 0
    missing_keys: list[str] = []


class ExcelValidationResponse(BaseModel):
    success: bool
    config_title: str = ""
    excel_sheets: list[str] = []
    missing_sheets: list[str] = []
    summary: Optional[SummaryResult] = None
    sheets: list[SheetResult] = []
    overall_pass: bool = False
    total_errors: int = 0
    total_warnings: int = 0
    error: Optional[dict] = None


# ── 解析相关 ──


class ParseResponse(BaseModel):
    success: bool
    content: Optional[dict] = None
    warnings: list[str] = []
    error: Optional[dict] = None


# ── 渲染相关 ──


class RenderBudgetResponse(BaseModel):
    success: bool
    output_path: Optional[str] = None
    error: Optional[dict] = None
```

- [ ] **Step 3: Commit**

```bash
git add report-engine/src/report_engine/budget/
git commit -m "feat(report-engine): add budget module with models"
```

---

### Task 2: 迁入 parse_excel_budget.py

**Files:**
- Create: `report-engine/src/report_engine/budget/parse_excel.py`

- [ ] **Step 1: 复制并调整导入**

将 `apps/desktop/sidecar/scripts/parse_excel_budget.py` 复制为 `report-engine/src/report_engine/budget/parse_excel.py`，调整顶部导入（无需改动，因为该文件只依赖 openpyxl、Pillow、标准库）。

```bash
cp apps/desktop/sidecar/scripts/parse_excel_budget.py report-engine/src/report_engine/budget/parse_excel.py
```

该文件无外部依赖变化，只需确认函数签名：
- `parse_excel_budget(input_path: str, output_dir: str, config: dict) -> tuple[dict, list[str]]`

- [ ] **Step 2: Commit**

```bash
git add report-engine/src/report_engine/budget/parse_excel.py
git commit -m "feat(report-engine): migrate parse_excel_budget from desktop sidecar"
```

---

### Task 3: 迁入 validate_excel.py

**Files:**
- Create: `report-engine/src/report_engine/budget/validate_excel.py`

- [ ] **Step 1: 复制并调整**

将 `apps/desktop/sidecar/api/validate_excel.py` 迁入为 `report-engine/src/report_engine/budget/validate_excel.py`。

需要做的调整：
1. 移除 `from fastapi import APIRouter` 和 router 定义（API 层移到 main.py）
2. 移除 Pydantic 请求/响应模型（已在 models.py 中定义）
3. 保留所有辅助函数和核心校验逻辑 `validate_excel_data()`
4. 保留 `_validate_detail_sheet()`、`_validate_summary_sheet()` 等内部函数
5. 导入模型从 `.models` 引用：

```python
"""Excel 数据校验：根据 BudgetConfig 校验 Excel 文件内容完整性。"""

import logging
from typing import Any, Optional

import openpyxl

from report_engine.budget.models import (
    ExcelValidationResponse,
    SheetResult,
    SummaryResult,
)

logger = logging.getLogger(__name__)

# ... 保留所有辅助函数不变 ...
# _is_empty, _safe_value, _cell_to_num, _is_numeric_field,
# _count_images_in_sheet, _find_anchors_for_image,
# _validate_detail_sheet, _validate_summary_sheet

# ... 保留 validate_excel_data() 不变 ...
```

- [ ] **Step 2: Commit**

```bash
git add report-engine/src/report_engine/budget/validate_excel.py
git commit -m "feat(report-engine): migrate validate_excel from desktop sidecar"
```

---

### Task 4: 迁入 build_payload.py

**Files:**
- Create: `report-engine/src/report_engine/budget/build_payload.py`

- [ ] **Step 1: 复制并调整**

将 `apps/desktop/sidecar/scripts/build_payload.py` 复制为 `report-engine/src/report_engine/budget/build_payload.py`。

需要做的调整：
1. 确认导入 `from report_engine.schema import Payload, Section, Block, Attachment, AttachmentsBundle`（已在 report-engine 中存在）
2. 保留核心函数 `build_payload()` 和所有辅助函数
3. 如果有 LLM 相关的导入（如 `auto_generate_from_template`），暂时保留但标记为可选

```bash
cp apps/desktop/sidecar/scripts/build_payload.py report-engine/src/report_engine/budget/build_payload.py
```

然后检查并调整 import 路径：
- `from report_engine.schema import ...` → 无需改动（已在 report-engine 内部）
- `from report_engine.template_parser import parse_template` → 无需改动

- [ ] **Step 2: Commit**

```bash
git add report-engine/src/report_engine/budget/build_payload.py
git commit -m "feat(report-engine): migrate build_payload from desktop sidecar"
```

---

### Task 5: 更新 __init__.py 确认导入正确

**Files:**
- Modify: `report-engine/src/report_engine/budget/__init__.py`

- [ ] **Step 1: 验证模块导入**

```bash
cd report-engine && .venv/bin/python -c "
from report_engine.budget.parse_excel import parse_excel_budget
from report_engine.budget.validate_excel import validate_excel_data
from report_engine.budget.build_payload import build_payload
print('All budget module imports OK')
"
```

Expected: `All budget module imports OK`

如果有导入错误，修复 import 路径后重试。

- [ ] **Step 2: Commit（如有修复）**

```bash
git add -u report-engine/src/report_engine/budget/
git commit -m "fix(report-engine): fix budget module import paths"
```

---

### Task 6: report-engine main.py 新增 budget 端点

**Files:**
- Modify: `report-engine/main.py`

- [ ] **Step 1: 添加 budget 端点**

在现有 `main.py` 末尾、`if __name__` 之前添加以下代码：

```python
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import File, Form, UploadFile
from fastapi.responses import FileResponse

from report_engine.budget.parse_excel import parse_excel_budget
from report_engine.budget.validate_excel import validate_excel_data
from report_engine.budget.build_payload import build_payload
from report_engine.budget.models import (
    ExcelValidationResponse,
    ParseResponse,
)

BUDGET_TEMP_DIR = Path(tempfile.gettempdir()) / "report-engine-budget"


def _cleanup_old_sessions():
    """启动时清理 > 24h 的临时文件。"""
    if not BUDGET_TEMP_DIR.exists():
        return
    import time
    cutoff = time.time() - 86400
    for d in BUDGET_TEMP_DIR.iterdir():
        if d.is_dir() and d.stat().st_mtime < cutoff:
            shutil.rmtree(d, ignore_errors=True)


@app.on_event("startup")
async def _budget_startup_cleanup():
    _cleanup_old_sessions()


@app.post("/validate-excel", response_model=ExcelValidationResponse)
async def validate_excel_endpoint(
    file: UploadFile = File(...),
    config: str = Form(...),
):
    """校验 Excel 文件是否符合 BudgetConfig 要求。"""
    import json
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid config JSON: {e}")

    tmp_path = Path(tempfile.mktemp(suffix=".xlsx"))
    try:
        content = await file.read()
        tmp_path.write_bytes(content)
        result = validate_excel_data(str(tmp_path), config_dict)
        return result
    except Exception as e:
        return ExcelValidationResponse(
            success=False,
            error={"code": "VALIDATE_ERROR", "message": str(e)},
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@app.post("/parse-excel", response_model=ParseResponse)
async def parse_excel_endpoint(
    file: UploadFile = File(...),
    config: str = Form(...),
    session_id: str = Form(...),
):
    """解析 Excel 文件，提取数据+图片，返回结构化内容。"""
    import json
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid config JSON: {e}")

    tmp_path = Path(tempfile.mktemp(suffix=".xlsx"))
    output_dir = BUDGET_TEMP_DIR / session_id
    try:
        content = await file.read()
        tmp_path.write_bytes(content)
        output_dir.mkdir(parents=True, exist_ok=True)
        content_dict, warnings = parse_excel_budget(
            str(tmp_path), str(output_dir), config_dict
        )
        # 将相对图片路径转为绝对路径
        for section in content_dict.get("sections", []):
            for block in section.get("blocks", []):
                if block.get("type") == "image":
                    path = block.get("path", "")
                    if path and not os.path.isabs(path):
                        block["path"] = os.path.abspath(path)
        return ParseResponse(success=True, content=content_dict, warnings=warnings)
    except Exception as e:
        return ParseResponse(
            success=False,
            error={"code": "PARSE_ERROR", "message": str(e)},
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@app.post("/render-budget")
async def render_budget_endpoint(
    content: dict[str, Any] = None,
    template_path: str = None,
    config: dict[str, Any] = None,
    session_id: str = None,
):
    """从解析内容渲染预算报告 DOCX。"""
    from fastapi import HTTPException

    # 支持 JSON body
    from fastapi import Request
    # 此端点用 JSON body
    pass


# 更简洁的 JSON body 版本
class RenderBudgetRequest(BaseModel):
    content: dict[str, Any]
    template_path: str
    config: dict[str, Any] = {}
    session_id: str = ""
    output_filename: str = "budget_report.docx"


@app.post("/render-budget")
async def render_budget_endpoint(req: RenderBudgetRequest):
    """从解析内容渲染预算报告 DOCX。"""
    if not Path(req.template_path).exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Template file not found")

    output_path = tempfile.mktemp(suffix=".docx")
    try:
        payload = build_payload(req.content, template_path=req.template_path)
        render_report(req.template_path, output_path, payload, check_template=False)

        # 清理 session 临时文件（图片等）
        if req.session_id:
            session_dir = BUDGET_TEMP_DIR / req.session_id
            if session_dir.exists():
                shutil.rmtree(session_dir, ignore_errors=True)

        return FileResponse(
            output_path,
            filename=req.output_filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as e:
        if Path(output_path).exists():
            Path(output_path).unlink()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
```

注意：需要确保顶部已有的 import 不重复。新增的 import 应合入文件顶部。

- [ ] **Step 2: 启动 report-engine 验证**

```bash
cd report-engine && .venv/bin/python -c "from main import app; print('Routes:', [r.path for r in app.routes])"
```

Expected: 输出包含 `/health`, `/parse-template`, `/render`, `/validate-excel`, `/parse-excel`, `/render-budget`

- [ ] **Step 3: Commit**

```bash
git add report-engine/main.py
git commit -m "feat(report-engine): add budget HTTP endpoints (validate, parse, render)"
```

---

### Task 7: 手动集成测试 report-engine budget 端点

**Files:** 无新文件

- [ ] **Step 1: 启动 report-engine**

```bash
cd report-engine && .venv/bin/python main.py &
sleep 2
curl http://localhost:8066/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 2: 测试 validate-excel**

```bash
curl -X POST http://localhost:8066/validate-excel \
  -F "file=@apps/desktop/public/samples/sample-budget.xlsx" \
  -F 'config=@apps/desktop/public/samples/sample-config.json;type=application/json'
```

Expected: JSON 响应包含 `{"success": true, "overall_pass": true/false, ...}`

- [ ] **Step 3: 测试 parse-excel**

```bash
SESSION_ID=$(uuidgen)
curl -X POST http://localhost:8066/parse-excel \
  -F "file=@apps/desktop/public/samples/sample-budget.xlsx" \
  -F "config=@apps/desktop/public/samples/sample-config.json;type=application/json" \
  -F "session_id=$SESSION_ID"
```

Expected: JSON 响应包含 `{"success": true, "content": {"sections": [...], ...}, "warnings": [...]}`

- [ ] **Step 4: 测试 render-budget**

（需要从 Step 3 的响应中提取 content，构造 JSON body）

```bash
# 先保存 parse 结果
curl -s -X POST http://localhost:8066/parse-excel \
  -F "file=@apps/desktop/public/samples/sample-budget.xlsx" \
  -F "config=@apps/desktop/public/samples/sample-config.json;type=application/json" \
  -F "session_id=test-session-1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
req = {
    'content': data['content'],
    'template_path': '$(pwd)/templates/budget_report.docx',
    'session_id': 'test-session-1'
}
json.dump(req, sys.stdout)
" > /tmp/render_req.json

curl -X POST http://localhost:8066/render-budget \
  -H "Content-Type: application/json" \
  -d @/tmp/render_req.json \
  --output /tmp/test_budget_report.docx

file /tmp/test_budget_report.docx
```

Expected: `Microsoft OOXML` 或类似输出

- [ ] **Step 5: 停止 report-engine**

```bash
kill %1 2>/dev/null || true
```

---

## Phase 2: Web 前端

### Task 8: 添加侧边栏导航入口

**Files:**
- Modify: `src/components/layout/navigation/schema.ts`

- [ ] **Step 1: 在 NAV_ITEMS 中添加预算报告项**

在 `schema.ts` 中：
1. 添加 `Calculator` 到 lucide-react 导入
2. 在 `automations` (order 5.5) 之前添加预算报告导航项

```typescript
// 修改 import 行
import { Bot, Calculator, Database, FilePenLine, FileText, FolderHeart, GitBranch, House, Info, LayoutGrid, Settings2, ShieldCheck, Users, WandSparkles } from "lucide-react";

// 在 automations 项之前添加
{ id: "budget", icon: Calculator, href: "/budget", label: "预算报告", section: "main", order: 5.3 },
```

- [ ] **Step 2: 验证导航渲染**

```bash
npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/navigation/schema.ts
git commit -m "feat(nav): add budget report sidebar entry"
```

---

### Task 9: 创建 budget API 客户端

**Files:**
- Create: `src/lib/budget-report-client.ts`

- [ ] **Step 1: 编写 API 客户端**

```typescript
/** report-engine 预算报告 API 客户端。 */

const REPORT_ENGINE_URL = process.env.NEXT_PUBLIC_REPORT_ENGINE_URL || "http://localhost:8066";

export interface ValidationResult {
  success: boolean;
  config_title: string;
  excel_sheets: string[];
  missing_sheets: string[];
  summary: {
    sheet_name: string;
    found: boolean;
    mode: string;
    mapped_count: number;
    missing_keys: string[];
  } | null;
  sheets: {
    sheet_name: string;
    found: boolean;
    missing_columns: string[];
    extra_columns: string[];
    total_rows: number;
    empty_cells: { row: number; column: string; field: string }[];
    fill_rate: number;
    numeric_violations: { row: number; column: string; value: string }[];
    image_summary: { total_images: number; rows_with_images: number } | null;
    warnings: string[];
  }[];
  overall_pass: boolean;
  total_errors: number;
  total_warnings: number;
  error: { code: string; message: string } | null;
}

export interface ParseResult {
  success: boolean;
  content: {
    title: string;
    sections: {
      name: string;
      id: string;
      blocks: { type: string; [key: string]: unknown }[];
    }[];
    extra_context: Record<string, string>;
  } | null;
  warnings: string[];
  error: { code: string; message: string } | null;
}

export async function validateBudgetExcel(
  file: File,
  config: Record<string, unknown>,
): Promise<ValidationResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("config", JSON.stringify(config));

  const res = await fetch(`${REPORT_ENGINE_URL}/validate-excel`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Validate failed: ${res.statusText}`);
  return res.json();
}

export async function parseBudgetExcel(
  file: File,
  config: Record<string, unknown>,
  sessionId: string,
): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("config", JSON.stringify(config));
  form.append("session_id", sessionId);

  const res = await fetch(`${REPORT_ENGINE_URL}/parse-excel`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Parse failed: ${res.statusText}`);
  return res.json();
}

export async function renderBudgetReport(
  content: Record<string, unknown>,
  templatePath: string,
  sessionId: string,
  filename = "budget_report.docx",
): Promise<Blob> {
  const res = await fetch(`${REPORT_ENGINE_URL}/render-budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      template_path: templatePath,
      session_id: sessionId,
      output_filename: filename,
    }),
  });
  if (!res.ok) throw new Error(`Render failed: ${res.statusText}`);
  return res.blob();
}

/** 列出可用的预算配置列表。 */
export async function listBudgetConfigs(): Promise<{ id: string; name: string }[]> {
  const res = await fetch("/budget-configs/index.json");
  if (!res.ok) return [];
  return res.json();
}

/** 获取配置内容。 */
export async function fetchBudgetConfig(
  id: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`/budget-configs/${id}`);
  if (!res.ok) throw new Error(`Config not found: ${id}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/budget-report-client.ts
git commit -m "feat(budget): add report-engine API client"
```

---

### Task 10: 准备静态资源文件

**Files:**
- Create: `public/budget-templates/budget_report.docx`（从 templates/ 拷贝）
- Create: `public/budget-configs/default.json`（从 desktop samples 拷贝）
- Create: `public/budget-configs/index.json`
- Create: `public/samples/sample-budget.xlsx`（从 desktop samples 拷贝）
- Create: `public/samples/sample-config.json`（从 desktop samples 拷贝）

- [ ] **Step 1: 拷贝模板和配置**

```bash
mkdir -p public/budget-templates public/budget-configs

cp templates/budget_report.docx public/budget-templates/
cp apps/desktop/public/samples/sample-config.json public/budget-configs/default.json
cp apps/desktop/public/samples/sample-budget.xlsx public/samples/
cp apps/desktop/public/samples/sample-config.json public/samples/
```

- [ ] **Step 2: 创建配置索引文件**

`public/budget-configs/index.json`:
```json
[
  { "id": "default.json", "name": "默认预算报告配置" }
]
```

- [ ] **Step 3: Commit**

```bash
git add public/budget-templates/ public/budget-configs/ public/samples/
git commit -m "feat(budget): add static templates and config files"
```

---

### Task 11: 创建 /budget 向导页面

**Files:**
- Create: `src/app/(dashboard)/budget/page.tsx`

这是核心前端任务。创建一个 3 步向导客户端组件。

- [ ] **Step 1: 创建向导页面**

```tsx
"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "@/components/batch/step-indicator";
import {
  validateBudgetExcel,
  parseBudgetExcel,
  renderBudgetReport,
  fetchBudgetConfig,
  listBudgetConfigs,
  type ValidationResult,
  type ParseResult,
} from "@/lib/budget-report-client";
import { cn } from "@/lib/utils";

const STEPS = ["选择模板与配置", "上传 Excel", "预览与生成"];

export default function BudgetWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [templateName, setTemplateName] = useState("budget_report.docx");
  const [configId, setConfigId] = useState("default.json");
  const [configList, setConfigList] = useState<{ id: string; name: string }[]>([]);

  // Step 2 state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Step 3 state
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  // 加载配置列表
  useState(() => {
    listBudgetConfigs().then(setConfigList).catch(() => {});
  });

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".xlsx") || file?.name.endsWith(".xls")) {
      setExcelFile(file);
      setValidation(null);
      setParseResult(null);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setValidation(null);
      setParseResult(null);
    }
  }, []);

  const handleValidateAndParse = useCallback(async () => {
    if (!excelFile) return;
    const config = await fetchBudgetConfig(configId);

    setIsValidating(true);
    try {
      const vResult = await validateBudgetExcel(excelFile, config);
      setValidation(vResult);
      if (!vResult.success) return;

      // 自动解析
      setIsParsing(true);
      const pResult = await parseBudgetExcel(excelFile, config, sessionId);
      setParseResult(pResult);
      if (pResult.success) {
        setCurrentStep(3);
      }
    } catch (err) {
      setValidation({
        success: false,
        config_title: "",
        excel_sheets: [],
        missing_sheets: [],
        summary: null,
        sheets: [],
        overall_pass: false,
        total_errors: 1,
        total_warnings: 0,
        error: { code: "NETWORK_ERROR", message: String(err) },
      });
    } finally {
      setIsValidating(false);
      setIsParsing(false);
    }
  }, [excelFile, configId, sessionId]);

  const handleGenerate = useCallback(async () => {
    if (!parseResult?.content) return;
    setIsGenerating(true);
    try {
      const blob = await renderBudgetReport(
        parseResult.content as Record<string, unknown>,
        `/budget-templates/${templateName}`,
        sessionId,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "budget_report.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`生成失败: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  }, [parseResult, templateName, sessionId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
        <h1 className="text-3xl font-[510] tracking-[-0.7px] text-foreground">
          预算报告生成
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          上传预算 Excel，自动生成格式化的预算报告文档
        </p>
      </div>

      <StepIndicator current={currentStep} total={3} labels={STEPS} />

      <Card>
        <CardContent className="pt-6">
          {/* Step 1: 选择模板与配置 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    报告模板
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span>{templateName}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">
                    解析配置
                  </label>
                  <select
                    value={configId}
                    onChange={(e) => setConfigId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                  >
                    {configList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 text-sm">
                  <a
                    href="/samples/sample-budget.xlsx"
                    download
                    className="text-primary hover:underline"
                  >
                    下载示例 Excel
                  </a>
                  <a
                    href="/samples/sample-config.json"
                    download
                    className="text-primary hover:underline"
                  >
                    下载示例配置
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 上传 Excel */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
                  excelFile
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                {excelFile ? (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{excelFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(excelFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">
                      拖拽 Excel 文件到此处
                    </p>
                    <p className="text-sm text-muted-foreground">或</p>
                    <label className="inline-block cursor-pointer">
                      <span className="text-sm text-primary hover:underline">
                        点击选择文件
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 校验结果 */}
              {validation && (
                <div className="space-y-3">
                  {validation.overall_pass ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">校验通过</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">
                          校验未通过 ({validation.total_errors} 个错误,{" "}
                          {validation.total_warnings} 个警告)
                        </span>
                      </div>
                      {validation.missing_sheets.length > 0 && (
                        <p className="text-sm text-red-600">
                          缺少 Sheet: {validation.missing_sheets.join(", ")}
                        </p>
                      )}
                      {validation.error && (
                        <p className="text-sm text-red-600">
                          {validation.error.message}
                        </p>
                      )}
                    </div>
                  )}

                  {validation.warnings && validation.total_warnings > 0 && (
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer">
                        查看详情 ({validation.total_warnings} 个警告)
                      </summary>
                      <div className="mt-2 space-y-1 pl-4">
                        {validation.sheets.map((s) => (
                          <div key={s.sheet_name}>
                            <p className="font-medium">{s.sheet_name}</p>
                            <p>填写率: {(s.fill_rate * 100).toFixed(1)}%</p>
                            {s.warnings.map((w, i) => (
                              <p key={i} className="text-yellow-600">
                                {w}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* 解析状态 */}
              {isParsing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在解析 Excel 数据...</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: 预览与生成 */}
          {currentStep === 3 && parseResult?.success && parseResult.content && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">解析结果预览</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">报告标题</p>
                    <p className="font-medium">{parseResult.content.title}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">数据板块</p>
                    <p className="font-medium">
                      {parseResult.content.sections.length} 个
                    </p>
                  </div>
                </div>

                {/* 各板块概览 */}
                <div className="space-y-2">
                  {parseResult.content.sections.map((section) => (
                    <div
                      key={section.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <p className="font-medium text-sm">{section.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.blocks.filter((b) => b.type === "table").length}{" "}
                        个表格,{" "}
                        {section.blocks.filter((b) => b.type === "image").length}{" "}
                        张图片
                      </p>
                    </div>
                  ))}
                </div>

                {/* 汇总信息 */}
                {Object.keys(parseResult.content.extra_context).length > 0 && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium mb-2">汇总数据</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(parseResult.content.extra_context).map(
                        ([k, v]) => (
                          <div key={k}>
                            <span className="text-muted-foreground">{k}: </span>
                            <span className="font-medium">{String(v)}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* 警告 */}
                {parseResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <p className="text-sm font-medium text-yellow-600 mb-1">
                      警告 ({parseResult.warnings.length})
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {parseResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 导航按钮 */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          上一步
        </Button>

        {currentStep === 1 && (
          <Button onClick={() => setCurrentStep(2)}>
            下一步
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {currentStep === 2 && (
          <Button
            onClick={handleValidateAndParse}
            disabled={!excelFile || isValidating || isParsing}
          >
            {isValidating || isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isValidating ? "校验中..." : "解析中..."}
              </>
            ) : (
              "校验并解析"
            )}
          </Button>
        )}

        {currentStep === 3 && (
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                生成报告
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误（可能有少量需要修复的）

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/budget/
git commit -m "feat(budget): add budget report wizard page with 3-step flow"
```

---

### Task 12: 端到端测试

**Files:** 无新文件

- [ ] **Step 1: 启动 report-engine**

```bash
cd report-engine && .venv/bin/python main.py &
sleep 2
```

- [ ] **Step 2: 启动 Web 开发服务器**

```bash
npm run dev
```

- [ ] **Step 3: 浏览器测试**

1. 打开 `http://localhost:8060/budget`
2. 确认侧边栏显示「预算报告」入口
3. Step 1: 确认模板和配置已选择，点击「下一步」
4. Step 2: 上传 `apps/desktop/public/samples/sample-budget.xlsx`
5. 点击「校验并解析」，确认校验通过
6. Step 3: 确认预览数据显示正确
7. 点击「生成报告」，确认 .docx 文件下载成功
8. 用 Word 打开下载的文件，确认格式正确

- [ ] **Step 4: 停止服务**

```bash
kill %1 %2 2>/dev/null || true
```

---

## Phase 3: Desktop 适配

### Task 13: 更新 Desktop 构建脚本

**Files:**
- Modify: `apps/desktop/scripts/build-sidecar.sh`

- [ ] **Step 1: 添加 report_engine 同步步骤**

在 `# Build` 注释行之前，添加同步步骤：

```bash
# 同步 report_engine 从主项目（确保 Desktop 用最新代码）
echo "Syncing report_engine from main project..."
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
rm -rf "$SIDECAR_DIR/report_engine"
cp -r "$REPO_ROOT/report-engine/src/report_engine" "$SIDECAR_DIR/report_engine"
echo "Synced report_engine (including budget module)"
```

- [ ] **Step 2: 添加 budget 模块的 hidden-import**

在 PyInstaller 命令的 `--hidden-import` 列表中添加：

```
--hidden-import report_engine.budget \
--hidden-import report_engine.budget.parse_excel \
--hidden-import report_engine.budget.validate_excel \
--hidden-import report_engine.budget.build_payload \
--hidden-import report_engine.budget.models \
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/scripts/build-sidecar.sh
git commit -m "feat(desktop): auto-sync report_engine budget module in build"
```

---

### Task 14: 更新 Desktop sidecar 导入路径

**Files:**
- Modify: `apps/desktop/sidecar/main.py`
- Modify: `apps/desktop/sidecar/api/parse.py`
- Modify: `apps/desktop/sidecar/api/render.py`
- Modify: `apps/desktop/sidecar/api/validate_excel.py`

- [ ] **Step 1: 更新 main.py 的 sys.path**

```python
# 改造前
sys.path.insert(0, str(SIDEKICK_DIR))
sys.path.insert(0, str(SIDEKICK_DIR / "scripts"))

# 改造后
sys.path.insert(0, str(SIDEKICK_DIR))
# scripts/ 目录不再需要（budget 模块已在 report_engine.budget 中）
```

- [ ] **Step 2: 更新 api/parse.py 导入**

```python
# 改造前
from parse_excel_budget import parse_excel_budget

# 改造后
from report_engine.budget.parse_excel import parse_excel_budget
```

- [ ] **Step 3: 更新 api/render.py 导入**

```python
# 改造前
from build_payload import build_payload

# 改造后
from report_engine.budget.build_payload import build_payload
```

- [ ] **Step 4: 更新 api/validate_excel.py 导入**

```python
# 改造前（模型定义在本地）
# 改造后
from report_engine.budget.models import (
    ExcelValidationResponse,
    SheetResult,
    SummaryResult,
)
from report_engine.budget.validate_excel import validate_excel_data
```

移除本地的 Pydantic 模型定义（`SheetResult`、`SummaryResult`、`ExcelValidationResponse`），改为从 `report_engine.budget.models` 导入。移除本地 `validate_excel_data` 函数实现，改为导入。

保留 `router` 和端点定义不变。

- [ ] **Step 5: 验证 sidecar 启动**

```bash
cd apps/desktop/sidecar && python3 main.py &
sleep 2
curl http://localhost:8765/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/sidecar/
git commit -m "refactor(desktop): update sidecar imports to use report_engine.budget"
```

---

## 最终检查

### Task 15: 全量类型检查和构建验证

- [ ] **Step 1: TypeScript 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 2: ESLint**

```bash
npm run lint
```

Expected: 无错误（允许 warning）

- [ ] **Step 3: Python 导入验证**

```bash
cd report-engine && .venv/bin/python -c "
from report_engine.budget import parse_excel_budget, validate_excel_data, build_payload
print('Budget module OK')
"
```

Expected: `Budget module OK`

- [ ] **Step 4: 最终 commit（如有修复）**

```bash
git add -A
git commit -m "fix: address lint and type check issues"
```
