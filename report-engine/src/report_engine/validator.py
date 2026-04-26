from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple

from report_engine.compat import normalize_payload
from report_engine.schema import Payload


BLOCK_REQUIRED_FIELDS = {
    "heading": ["text"],
    "paragraph": ["text"],
    "bullet_list": ["items"],
    "numbered_list": ["items"],
    "table": ["headers", "rows"],
    "three_line_table": ["headers", "rows"],
    "image": ["path"],
    "page_break": [],
    # P1
    "rich_paragraph": ["segments"],
    "note": ["text"],
    "quote": ["text"],
    "two_images_row": ["images"],
    # P2
    "appendix_table": ["headers", "rows"],
    "checklist": ["items"],
    "horizontal_rule": [],
    # P3
    "toc_placeholder": [],
    "code_block": ["code"],
    "formula": ["latex"],
    "columns": ["count", "columns"],
    "ascii_diagram": ["ascii"],
    "mermaid": ["code"],
}

logger = logging.getLogger("report_engine")


class PayloadValidationError(ValueError):
    pass


def _validate_block_fields(block: Dict[str, Any], scope: str) -> None:
    block_type = block.get("type")
    if not block_type:
        raise PayloadValidationError(f"{scope}: block missing required field 'type'")

    if block_type not in BLOCK_REQUIRED_FIELDS:
        raise PayloadValidationError(f"{scope}: unsupported block type '{block_type}'")

    missing = [field for field in BLOCK_REQUIRED_FIELDS[block_type] if field not in block]
    if missing:
        raise PayloadValidationError(
            f"{scope}: block type '{block_type}' missing required fields: {', '.join(missing)}"
        )


def validate_payload(payload: Dict[str, Any], *, strict_images: bool = False) -> Tuple[Payload, List[str]]:
    normalized = normalize_payload(payload)
    model = Payload.model_validate(normalized)
    logger.debug(
        "Validating payload with %d sections, %d attachments",
        len(model.sections),
        len(model.attachments),
    )

    warnings: List[str] = []
    section_ids = set()
    attachment_ids = set()
    placeholders = set()
    flags = set()

    for section in model.sections:
        if section.id in section_ids:
            raise PayloadValidationError(f"Duplicate section id: {section.id}")
        section_ids.add(section.id)

        if section.placeholder in placeholders:
            raise PayloadValidationError(f"Duplicate placeholder: {section.placeholder}")
        placeholders.add(section.placeholder)

        if section.flag_name:
            if section.flag_name in flags:
                raise PayloadValidationError(f"Duplicate flag_name: {section.flag_name}")
            flags.add(section.flag_name)

        for block in section.blocks:
            raw_block = block.model_dump()
            _validate_block_fields(raw_block, f"section[{section.id}]")
            if raw_block["type"] == "image":
                image_path = Path(str(raw_block["path"]))
                if not image_path.exists():
                    message = f"section[{section.id}]: image not found: {image_path}"
                    if strict_images:
                        raise PayloadValidationError(message)
                    warnings.append(message)

    for attachment in model.attachments:
        if attachment.id in attachment_ids:
            raise PayloadValidationError(f"Duplicate attachment id: {attachment.id}")
        attachment_ids.add(attachment.id)

        if attachment.placeholder in placeholders:
            raise PayloadValidationError(f"Duplicate placeholder: {attachment.placeholder}")
        placeholders.add(attachment.placeholder)

        if attachment.flag_name:
            if attachment.flag_name in flags:
                raise PayloadValidationError(f"Duplicate flag_name: {attachment.flag_name}")
            flags.add(attachment.flag_name)

        for block in attachment.blocks:
            raw_block = block.model_dump()
            _validate_block_fields(raw_block, f"attachment[{attachment.id}]")
            if raw_block["type"] == "image":
                image_path = Path(str(raw_block["path"]))
                if not image_path.exists():
                    message = f"attachment[{attachment.id}]: image not found: {image_path}"
                    if strict_images:
                        raise PayloadValidationError(message)
                    warnings.append(message)

    return model, warnings
