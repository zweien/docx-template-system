from __future__ import annotations

from typing import Any, Dict, List, Optional

from docxtpl import DocxTemplate

from report_engine.blocks import BlockRegistry, DEFAULT_STYLE_MAP, create_default_registry


def build_subdoc(
    tpl: DocxTemplate,
    blocks: List[Dict[str, Any]],
    style_map: Optional[Dict[str, str]] = None,
    registry: Optional[BlockRegistry] = None,
    title: Optional[str] = None,
    title_level: int = 2,
) -> Any:
    merged_style_map = dict(DEFAULT_STYLE_MAP)
    if style_map:
        merged_style_map.update(style_map)

    active_registry = registry or create_default_registry()
    subdoc = tpl.new_subdoc()

    if title:
        active_registry.render(
            subdoc,
            {"type": "heading", "text": title, "level": title_level},
            merged_style_map,
        )

    for block in blocks:
        active_registry.render(subdoc, block, merged_style_map)

    return subdoc
