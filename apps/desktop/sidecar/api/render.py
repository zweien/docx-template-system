import os
import json
import tempfile
import subprocess
import sys
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).parents[3]
SKILL_DIR = PROJECT_ROOT / ".claude" / "skills" / "report-generator" / "scripts"
REPORT_ENGINE = PROJECT_ROOT / "report-engine"

router = APIRouter()

class RenderRequest(BaseModel):
    content: dict
    template_path: str
    output_dir: str

class RenderResponse(BaseModel):
    success: bool
    output_path: str | None = None
    error: dict | None = None

@router.post("/render", response_model=RenderResponse)
def render_report(req: RenderRequest):
    try:
        # 1. Save content.json
        work_dir = Path(req.output_dir)
        work_dir.mkdir(parents=True, exist_ok=True)
        content_path = work_dir / "content.json"
        content_path.write_text(json.dumps(req.content, ensure_ascii=False), encoding="utf-8")

        # 2. Call build_payload.py
        payload_path = work_dir / "payload.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SKILL_DIR / "build_payload.py"),
                "--content", str(content_path),
                "--output", str(payload_path),
                "--template", req.template_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            return RenderResponse(
                success=False,
                error={"code": "BUILD_PAYLOAD_ERROR", "message": result.stderr},
            )

        # 3. Call report-engine render
        output_path = work_dir / "report.docx"
        result = subprocess.run(
            [
                sys.executable, "-m", "report_engine.cli",
                "render",
                "--template", req.template_path,
                "--payload", str(payload_path),
                "--output", str(output_path),
            ],
            cwd=str(REPORT_ENGINE),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            return RenderResponse(
                success=False,
                error={"code": "RENDER_ERROR", "message": result.stderr},
            )

        return RenderResponse(success=True, output_path=str(output_path))
    except Exception as e:
        return RenderResponse(
            success=False,
            error={"code": "UNKNOWN_ERROR", "message": str(e)},
        )
