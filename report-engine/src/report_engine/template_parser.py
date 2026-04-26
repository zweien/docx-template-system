import re
from typing import List, Tuple
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def _read_template_xml(template_path: str) -> str:
    with ZipFile(template_path) as zf:
        xml_parts = []
        for name in zf.namelist():
            if name.startswith("word/") and name.endswith(".xml"):
                xml_parts.append(zf.read(name).decode("utf-8", errors="ignore"))
        return "\n".join(xml_parts)


def _read_document_xml(template_path: str) -> str:
    """Read only word/document.xml from the template zip."""
    with ZipFile(template_path) as zf:
        return zf.read("word/document.xml").decode("utf-8", errors="ignore")


def _extract_paragraphs(xml: str) -> List[dict]:
    """Parse word/document.xml and return paragraphs in order with style and text info."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []

    paragraphs = []
    for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
        style_val = None
        pPr = p.find("w:pPr", NS)
        if pPr is not None:
            pStyle = pPr.find("w:pStyle", NS)
            if pStyle is not None:
                style_val = pStyle.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")

        texts = []
        for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
            if t.text:
                texts.append(t.text)
        full_text = "".join(texts).strip()

        paragraphs.append({"style": style_val, "text": full_text})

    return paragraphs


def _extract_section_headings(xml: str, sections: List[dict]) -> None:
    """Extract headings from template XML and assign them to the matching section.

    Walks paragraphs in order. Headings that appear before a subdoc placeholder
    are assigned to that section. The lookup uses the placeholder text found in
    the paragraph (e.g. ``{{p RESEARCH_CONTENT_SUBDOC }}``).
    """
    paragraphs = _extract_paragraphs(xml)
    placeholder_to_section = {s["placeholder"]: s for s in sections}

    # Build a mapping: paragraph index -> section for each subdoc placeholder occurrence
    pending_headings: List[dict] = []

    for para in paragraphs:
        style = para.get("style") or ""
        text = para.get("text", "")
        is_heading = style.lower().startswith("heading") if style else False

        # Check if this paragraph contains a subdoc placeholder
        subdoc_match = re.search(r"\{\{p\s+" + _VAR_RE + r"\s*\}\}", text)

        if subdoc_match:
            placeholder = subdoc_match.group(1)
            sec = placeholder_to_section.get(placeholder)
            if sec:
                sec["template_headings"] = list(pending_headings)
            pending_headings = []
        elif is_heading:
            # Skip paragraphs that contain Jinja template syntax
            if "{{" in text or "{%" in text:
                continue
            try:
                level = int(style.replace("Heading", "").replace("heading", ""))
            except ValueError:
                level = 1
            pending_headings.append({"text": text, "level": level})


# Matches variable names: ASCII uppercase/digits/underscores OR CJK characters
_VAR_RE = r"([A-Z_][A-Z0-9_]*|[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9_]*)"


def _extract_scalar_vars(xml: str) -> List[str]:
    pattern = r"\{\{\s*" + _VAR_RE + r"\b"
    seen = set()
    return [v for v in re.findall(pattern, xml) if not (v in seen or seen.add(v))]


def _extract_subdoc_placeholders(xml: str) -> List[str]:
    pattern = r"\{\{p\s+" + _VAR_RE + r"\s*\}\}"
    seen = set()
    return [v for v in re.findall(pattern, xml) if not (v in seen or seen.add(v))]


def _extract_flags(xml: str) -> List[str]:
    pattern = r"\{%p\s+if\s+" + _VAR_RE + r"\s*%\}"
    seen = set()
    return [v for v in re.findall(pattern, xml) if not (v in seen or seen.add(v))]


def _is_cjk(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def _pair_flags_with_subdocs(flags, subdocs):
    sections = []
    used_subdocs = set()

    # Pass 1: conventional ENABLE_*/*_SUBDOC pairing
    for flag in flags:
        base = flag.replace("ENABLE_", "")
        placeholder = f"{base}_SUBDOC"
        if placeholder in subdocs:
            title = base.replace("_", " ").title()
            sections.append({
                "id": base.lower(),
                "placeholder": placeholder,
                "flag_name": flag,
                "title": title,
                "required_styles": [],
            })
            used_subdocs.add(placeholder)

    # Pass 2: CJK or unconventional names — pair flag with next unpaired subdoc by XML order
    if len(sections) < len(flags):
        unpaired_subdocs = [s for s in subdocs if s not in used_subdocs and s != "APPENDICES_SUBDOC"]
        for flag in flags:
            if any(s["flag_name"] == flag for s in sections):
                continue
            if unpaired_subdocs:
                placeholder = unpaired_subdocs.pop(0)
                used_subdocs.add(placeholder)
                has_cjk = _is_cjk(flag) or _is_cjk(placeholder)
                section_id = flag if has_cjk else flag.replace("ENABLE_", "").lower()
                title = flag if has_cjk else flag.replace("ENABLE_", "").replace("_", " ").title()
                sections.append({
                    "id": section_id,
                    "placeholder": placeholder,
                    "flag_name": flag,
                    "title": title,
                    "required_styles": [],
                })

    return sections


def parse_template(template_path: str) -> Tuple[dict, List[str]]:
    warnings = []
    xml = _read_template_xml(template_path)
    scalar_vars = _extract_scalar_vars(xml)
    subdocs = _extract_subdoc_placeholders(xml)
    flags = _extract_flags(xml)
    context_vars = [v for v in scalar_vars if not v.startswith("ENABLE_")]
    sections = _pair_flags_with_subdocs(flags, subdocs)

    paired_subdocs = {s["placeholder"] for s in sections}
    for sd in subdocs:
        if sd not in paired_subdocs and sd != "APPENDICES_SUBDOC":
            warnings.append(f"Subdoc {sd} has no ENABLE flag, will default to enabled")

    if not sections:
        warnings.append("No recognizable sections found in template")

    attachments_bundle = None
    if "APPENDICES_SUBDOC" in subdocs:
        attachments_bundle = {"placeholder": "APPENDICES_SUBDOC", "flag_name": "ENABLE_APPENDICES"}

    _extract_section_headings(_read_document_xml(template_path), sections)

    structure = {
        "context_vars": context_vars,
        "sections": sections,
        "attachments_bundle": attachments_bundle,
        "required_styles": [],
    }
    return structure, warnings
