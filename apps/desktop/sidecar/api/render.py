from fastapi import APIRouter
from pydantic import BaseModel

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
    return RenderResponse(success=True, output_path="/tmp/report.docx")
