import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent / "src"))
from report_engine.renderer import render_report
from report_engine.template_parser import parse_template
from report_engine.budget.parse_excel import parse_excel_budget
from report_engine.budget.validate_excel import validate_excel_data
from report_engine.budget.build_payload import build_payload
from report_engine.budget.models import (
    ExcelValidationResponse,
    ParseResponse,
    RenderBudgetRequest,
)

app = FastAPI(title="Report Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BUDGET_TEMP_DIR = Path(tempfile.gettempdir()) / "report-engine-budget"


class ParseRequest(BaseModel):
    template_path: str


class RenderRequest(BaseModel):
    template_path: str
    payload: dict[str, Any]
    output_filename: str = "report.docx"


@app.on_event("startup")
async def _cleanup_old_sessions():
    if not BUDGET_TEMP_DIR.exists():
        return
    import time
    cutoff = time.time() - 86400
    for d in BUDGET_TEMP_DIR.iterdir():
        if d.is_dir() and d.stat().st_mtime < cutoff:
            shutil.rmtree(d, ignore_errors=True)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse-template")
async def parse_template_endpoint(req: ParseRequest):
    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")
    structure, warnings = parse_template(req.template_path)
    return {"structure": structure, "warnings": warnings}


@app.post("/render")
async def render_endpoint(req: RenderRequest):
    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    output_path = tempfile.mktemp(suffix=".docx")
    try:
        render_report(req.template_path, output_path, req.payload, check_template=False)
        filename = req.output_filename or "report.docx"
        return FileResponse(output_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    except Exception as e:
        if Path(output_path).exists():
            Path(output_path).unlink()
        raise HTTPException(status_code=500, detail=str(e))


# ── Budget report endpoints ──


@app.post("/validate-excel", response_model=ExcelValidationResponse)
async def validate_excel_endpoint(
    file: UploadFile = File(...),
    config: str = Form(...),
):
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid config JSON: {e}")

    tmp_path = Path(tempfile.mktemp(suffix=".xlsx"))
    try:
        tmp_path.write_bytes(await file.read())
        return validate_excel_data(str(tmp_path), config_dict)
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
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid config JSON: {e}")

    tmp_path = Path(tempfile.mktemp(suffix=".xlsx"))
    output_dir = BUDGET_TEMP_DIR / session_id
    try:
        tmp_path.write_bytes(await file.read())
        output_dir.mkdir(parents=True, exist_ok=True)
        content_dict, warnings = parse_excel_budget(
            str(tmp_path), str(output_dir), config_dict
        )
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
async def render_budget_endpoint(req: RenderBudgetRequest):
    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    output_path = tempfile.mktemp(suffix=".docx")
    try:
        payload = build_payload(req.content, template_path=req.template_path)
        render_report(req.template_path, output_path, payload, check_template=False)

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
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8066"))
    uvicorn.run(app, host="0.0.0.0", port=port)
