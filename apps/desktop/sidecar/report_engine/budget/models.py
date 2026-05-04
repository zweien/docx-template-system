"""预算报告相关 Pydantic 模型。"""

from typing import Any, Optional

from pydantic import BaseModel


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


class ParseResponse(BaseModel):
    success: bool
    content: Optional[dict] = None
    warnings: list[str] = []
    error: Optional[dict] = None


class RenderBudgetRequest(BaseModel):
    content: dict[str, Any]
    template_path: str
    config: dict[str, Any] = {}
    session_id: str = ""
    output_filename: str = "budget_report.docx"
