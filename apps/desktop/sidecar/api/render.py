import json
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

from report_engine.budget.build_payload import build_payload
from report_engine.renderer import render_report as _render_report

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
def render_report_endpoint(req: RenderRequest):
    try:
        work_dir = Path(req.output_dir)
        work_dir.mkdir(parents=True, exist_ok=True)

        payload = build_payload(req.content, template_path=req.template_path)
        output_path = work_dir / "report.docx"
        _render_report(
            template_path=req.template_path,
            output_path=str(output_path),
            payload=payload,
        )

        return RenderResponse(success=True, output_path=str(output_path))
    except Exception as e:
        return RenderResponse(
            success=False,
            error={"code": "UNKNOWN_ERROR", "message": str(e)},
        )
