"""Excel 数据校验端点：根据 BudgetConfig 校验 Excel 文件内容完整性。"""

from fastapi import APIRouter
from pydantic import BaseModel

from report_engine.budget.models import (
    ExcelValidationResponse,
    SheetResult,
    SummaryResult,
)
from report_engine.budget.validate_excel import validate_excel_data

router = APIRouter(tags=["validate"])


# ── 请求模型 ──

class ValidateExcelRequest(BaseModel):
    input_path: str
    config: dict


@router.post("/validate-excel-data", response_model=ExcelValidationResponse)
def validate_excel_endpoint(req: ValidateExcelRequest):
    """POST /api/validate-excel-data — 校验 Excel 数据是否符合配置要求。"""
    return validate_excel_data(req.input_path, req.config)
