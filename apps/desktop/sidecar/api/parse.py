from fastapi import APIRouter
from pydantic import BaseModel

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
    return ParseResponse(success=True, content={}, warnings=[])
