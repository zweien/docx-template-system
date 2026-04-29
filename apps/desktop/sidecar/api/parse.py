import os
import sys
import tempfile
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).parents[3]
SKILL_DIR = PROJECT_ROOT / ".claude" / "skills" / "report-generator" / "scripts"
sys.path.insert(0, str(SKILL_DIR))

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

@router.post("/parse-excel", response_model=ParseResponse)
def parse_excel(req: ParseRequest):
    try:
        output_dir = tempfile.mkdtemp(prefix="budget_parse_")
        content, warnings = parse_excel_budget(
            req.input_path, output_dir, req.config
        )
        # Convert image paths to absolute paths
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
