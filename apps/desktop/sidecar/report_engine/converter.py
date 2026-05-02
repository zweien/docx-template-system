from typing import Any, Dict, List


def _extract_text(content: Any) -> str:
    """Extract plain text from BlockNote content array."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for segment in content:
            if isinstance(segment, dict):
                text = segment.get("text", "")
                if isinstance(text, dict):
                    text = text.get("text", str(text))
                parts.append(str(text))
        return "".join(parts)
    return ""


def _has_inline_styles(segments: Any) -> bool:
    """Check if any segment has non-empty styles."""
    if not isinstance(segments, list):
        return False
    return any(isinstance(seg, dict) and seg.get("styles") for seg in segments)


def _convert_rich_paragraph(block: dict) -> dict:
    """Convert a BlockNote paragraph with inline styles to rich_paragraph."""
    segments = []
    for seg in block.get("content", []):
        if not isinstance(seg, dict):
            continue
        s = {"text": seg.get("text", "")}
        styles = seg.get("styles", {})
        if styles.get("bold"):
            s["bold"] = True
        if styles.get("italic"):
            s["italic"] = True
        segments.append(s)
    return {"type": "rich_paragraph", "segments": segments}


def _convert_paragraph(block: dict) -> dict:
    """Convert a plain BlockNote paragraph."""
    content = block.get("content", [])
    if _has_inline_styles(content):
        return _convert_rich_paragraph(block)
    text = _extract_text(content)
    return {"type": "paragraph", "text": text}


def _convert_heading(block: dict) -> dict:
    text = _extract_text(block.get("content", []))
    level = block.get("props", {}).get("level", 2)
    return {"type": "heading", "text": text, "level": level}


def _convert_table(block: dict) -> dict:
    """Convert BlockNote table to report-engine table."""
    rows = []
    content = block.get("content", {})
    if isinstance(content, dict):
        for row in content.get("rows", []):
            cells = [
                _extract_text(cell.get("content", [])) if isinstance(cell, dict) else str(cell)
                for cell in row.get("cells", [])
            ]
            rows.append(cells)
    elif isinstance(content, list):
        for row in content:
            if isinstance(row, list):
                rows.append([_extract_text(c) if isinstance(c, dict) else str(c) for c in row])

    if not rows:
        return None

    headers = rows[0]
    data_rows = rows[1:] if len(rows) > 1 else []
    return {"type": "table", "title": "", "headers": headers, "rows": data_rows}


def _convert_quote(block: dict) -> dict:
    text = _extract_text(block.get("content", []))
    return {"type": "quote", "text": text}


def _convert_code_block(block: dict) -> dict:
    code = _extract_text(block.get("content", []))
    language = block.get("props", {}).get("language", "")
    if language == "mermaid":
        return {"type": "mermaid", "code": code}
    return {"type": "code_block", "code": code}


def _convert_image(block: dict) -> dict:
    props = block.get("props", {})
    url = props.get("url", props.get("src", ""))
    if not url:
        return None
    return {
        "type": "image",
        "path": url,
        "width": props.get("width"),
        "caption": props.get("caption", ""),
    }


def convert_blocknote_blocks(blocks: List[dict]) -> List[dict]:
    """Convert a list of BlockNote blocks to report-engine blocks."""
    result = []
    i = 0

    while i < len(blocks):
        block = blocks[i]
        if not isinstance(block, dict):
            i += 1
            continue

        block_type = block.get("type", "")

        if block_type == "heading":
            result.append(_convert_heading(block))
        elif block_type == "paragraph":
            converted = _convert_paragraph(block)
            if converted:
                result.append(converted)
        elif block_type == "bulletListItem":
            items = []
            while i < len(blocks) and isinstance(blocks[i], dict) and blocks[i].get("type") == "bulletListItem":
                items.append(_extract_text(blocks[i].get("content", [])))
                i += 1
            result.append({"type": "bullet_list", "items": items})
            continue
        elif block_type == "numberedListItem":
            items = []
            while i < len(blocks) and isinstance(blocks[i], dict) and blocks[i].get("type") == "numberedListItem":
                items.append(_extract_text(blocks[i].get("content", [])))
                i += 1
            result.append({"type": "numbered_list", "items": items})
            continue
        elif block_type == "table":
            converted = _convert_table(block)
            if converted:
                result.append(converted)
        elif block_type == "tableCaption":
            caption_text = block.get("props", {}).get("text", "")
            if caption_text and result and result[-1].get("type") == "table":
                result[-1]["title"] = caption_text
            i += 1
            continue
        elif block_type == "quote":
            result.append(_convert_quote(block))
        elif block_type == "codeBlock":
            result.append(_convert_code_block(block))
        elif block_type == "image":
            converted = _convert_image(block)
            if converted:
                result.append(converted)
        elif block_type == "divider":
            result.append({"type": "horizontal_rule"})
        elif block_type == "mermaidBlock":
            code = block.get("props", {}).get("code", "")
            result.append({"type": "mermaid", "code": code})
        elif block_type == "checkListItem":
            items = []
            checked = []
            while i < len(blocks) and isinstance(blocks[i], dict) and blocks[i].get("type") == "checkListItem":
                items.append(_extract_text(blocks[i].get("content", [])))
                checked.append(blocks[i].get("props", {}).get("checked", False))
                i += 1
            result.append({"type": "checklist", "items": items, "checked": checked})
            continue
        elif block_type == "pageBreak":
            result.append({"type": "page_break"})
        # Unsupported types silently ignored

        i += 1

    return result


def _is_blocknote_blocks(blocks: List[dict]) -> bool:
    """Check if blocks are stored in BlockNote editor format."""
    if not blocks:
        return False
    return all(
        isinstance(b, dict) and "id" in b and "type" in b
        for b in blocks
    )


def _convert_checklist_blocks(blocks: List[dict]) -> List[dict]:
    """Convert BlockNote checkListItem blocks to engine checklist."""
    items = []
    checked = []
    for b in blocks:
        if b.get("type") != "checkListItem":
            break
        items.append(_extract_text(b.get("content", [])))
        checked.append(b.get("props", {}).get("checked", False))
    return [{"type": "checklist", "items": items, "checked": checked}]


def _normalize_blocks(blocks: List[dict]) -> List[dict]:
    """Adjust block formats from frontend storage to report-engine expectations."""
    from server.config import UPLOADS_DIR

    result = []
    for block in blocks:
        b = dict(block)
        if b.get("type") == "checklist" and "checked" in b:
            items = []
            for i, text in enumerate(b.get("items", [])):
                items.append({"text": str(text), "checked": bool(b["checked"][i]) if i < len(b["checked"]) else False})
            b["items"] = items
            b.pop("checked", None)
        if b.get("type") == "image" and b.get("path", "").startswith("/api/upload/files/"):
            filename = b["path"].rsplit("/", 1)[-1]
            b["path"] = str(UPLOADS_DIR / filename)
        result.append(b)
    return result


def _strip_template_headings(blocks_data: list, section_meta: dict) -> list:
    """Remove leading heading blocks that were imported from the template.

    Template headings already exist in the template body before each subdoc
    placeholder, so including them in the subdoc would cause duplicates.
    """
    th = section_meta.get("template_headings")
    if not th:
        return blocks_data
    n = len(th)
    # Count leading heading blocks
    heading_count = 0
    for b in blocks_data:
        if b.get("type") == "heading":
            heading_count += 1
        else:
            break
    if heading_count >= n:
        return blocks_data[n:]
    return blocks_data


def draft_to_payload(draft_data: dict, template_parsed_structure: dict) -> dict:
    """Convert a draft to a report-engine payload.

    The draft stores engine-format blocks (already converted from BlockNote
    by the frontend), so we pass them through directly with minor format
    adjustments where the frontend format differs from report-engine.
    """
    section_enabled = draft_data.get("section_enabled", {})
    sections = []
    for section_meta in template_parsed_structure.get("sections", []):
        section_id = section_meta["id"]
        blocks_data = draft_data.get("sections", {}).get(section_id, [])
        if _is_blocknote_blocks(blocks_data):
            blocks_data = convert_blocknote_blocks(blocks_data)
        blocks_data = _normalize_blocks(blocks_data)
        blocks_data = _strip_template_headings(blocks_data, section_meta)

        sections.append({
            "id": section_id,
            "placeholder": section_meta["placeholder"],
            "flag_name": section_meta["flag_name"],
            "enabled": section_enabled.get(section_id, True),
            "blocks": blocks_data,
        })

    payload = {
        "context": draft_data.get("context", {}),
        "sections": sections,
        "attachments": [],
        "attachments_bundle": None,
        "style_map": {},
    }

    bundle_meta = template_parsed_structure.get("attachments_bundle")
    if bundle_meta:
        section_placeholders = {s["placeholder"] for s in sections}
        if bundle_meta["placeholder"] not in section_placeholders:
            payload["attachments_bundle"] = {
                "enabled": True,
                "placeholder": bundle_meta["placeholder"],
                "flag_name": bundle_meta["flag_name"],
            }

    return payload
