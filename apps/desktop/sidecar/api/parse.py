import os
import tempfile
from fastapi import APIRouter
from pydantic import BaseModel

from parse_excel_budget import parse_excel_budget

router = APIRouter()


class ParseRequest(BaseModel):
    input_path: str
    config: dict


class ParseResponse(BaseModel):
    success: bool
    content: dict | None = None
    warnings: list[str] = []
    error: dict | None = None


class ParseTemplateRequest(BaseModel):
    template_path: str


@router.post("/parse-excel", response_model=ParseResponse)
def parse_excel(req: ParseRequest):
    try:
        output_dir = tempfile.mkdtemp(prefix="budget_parse_")
        content, warnings = parse_excel_budget(
            req.input_path, output_dir, req.config
        )
        for section in content.get("sections", []):
            for block in section.get("blocks", []):
                if block.get("type") == "image":
                    path = block.get("path", "")
                    if path and not os.path.isabs(path):
                        block["path"] = os.path.abspath(path)
        return ParseResponse(success=True, content=content, warnings=warnings)
    except Exception as e:
        return ParseResponse(
            success=False,
            warnings=[],
            error={"code": "PARSE_ERROR", "message": str(e)},
        )


@router.post("/parse-template")
def parse_template_endpoint(req: ParseTemplateRequest):
    try:
        from report_engine.template_parser import parse_template

        structure, warnings = parse_template(req.template_path)
        return {"structure": structure, "warnings": warnings}
    except Exception as e:
        return {"error": {"code": "PARSE_TEMPLATE_ERROR", "message": str(e)}}
