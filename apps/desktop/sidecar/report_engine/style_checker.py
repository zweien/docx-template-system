from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from docx import Document
from docx.enum.style import WD_STYLE_TYPE

from report_engine.blocks import DEFAULT_STYLE_MAP


STYLE_TYPE_REQUIREMENTS = {
    "heading_1": WD_STYLE_TYPE.PARAGRAPH,
    "heading_2": WD_STYLE_TYPE.PARAGRAPH,
    "heading_3": WD_STYLE_TYPE.PARAGRAPH,
    "heading_4": WD_STYLE_TYPE.PARAGRAPH,
    "heading_5": WD_STYLE_TYPE.PARAGRAPH,
    "body": WD_STYLE_TYPE.PARAGRAPH,
    "table_caption": WD_STYLE_TYPE.PARAGRAPH,
    "figure_caption": WD_STYLE_TYPE.PARAGRAPH,
    "legend": WD_STYLE_TYPE.PARAGRAPH,
    "figure_paragraph": WD_STYLE_TYPE.PARAGRAPH,
    "bullet_list": WD_STYLE_TYPE.PARAGRAPH,
    "numbered_list": WD_STYLE_TYPE.PARAGRAPH,
    "note": WD_STYLE_TYPE.PARAGRAPH,
    "quote": WD_STYLE_TYPE.PARAGRAPH,
    "checklist": WD_STYLE_TYPE.PARAGRAPH,
    "code_block": WD_STYLE_TYPE.PARAGRAPH,
    "table": WD_STYLE_TYPE.TABLE,
    "appendix_table": WD_STYLE_TYPE.TABLE,
}


@dataclass
class StyleCheckResult:
    ok: bool
    missing: List[str] = field(default_factory=list)
    wrong_type: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class StyleCheckError(ValueError):
    pass


def check_template_styles(template_path: str, style_map: Dict[str, str] | None = None) -> StyleCheckResult:
    merged_style_map = dict(DEFAULT_STYLE_MAP)
    if style_map:
        merged_style_map.update(style_map)

    doc = Document(template_path)
    styles_by_name = {style.name: style for style in doc.styles}

    missing: List[str] = []
    wrong_type: List[str] = []
    for key, expected_type in STYLE_TYPE_REQUIREMENTS.items():
        style_name = merged_style_map[key]
        style = styles_by_name.get(style_name)
        if style is None:
            missing.append(style_name)
            continue
        if style.type != expected_type:
            wrong_type.append(style_name)

    return StyleCheckResult(
        ok=not missing and not wrong_type,
        missing=missing,
        wrong_type=wrong_type,
        warnings=[],
    )


def ensure_template_styles(template_path: str, style_map: Dict[str, str] | None = None) -> None:
    result = check_template_styles(template_path, style_map)
    if not result.ok:
        parts = []
        if result.missing:
            parts.append(f"missing styles: {', '.join(result.missing)}")
        if result.wrong_type:
            parts.append(f"wrong style types: {', '.join(result.wrong_type)}")
        raise StyleCheckError("; ".join(parts))
