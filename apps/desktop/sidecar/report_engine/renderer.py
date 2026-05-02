from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

from docxtpl import DocxTemplate

from report_engine.blocks import create_default_registry
from report_engine.compat import normalize_payload
from report_engine.schema import Payload
from report_engine.style_checker import ensure_template_styles
from report_engine.prompt_parser import filter_prompt_paragraphs
from report_engine.subdoc import build_subdoc
from report_engine.template_checker import ensure_template_contract
from report_engine.validator import validate_payload

logger = logging.getLogger("report_engine")


def _build_sections_context(
    tpl: DocxTemplate,
    payload: Payload,
    context: Dict[str, Any],
    style_map: Dict[str, str],
) -> None:
    for section in payload.sections:
        flag_name = section.flag_name or f"ENABLE_{section.id.upper()}"
        context[flag_name] = bool(section.enabled)

        if section.enabled:
            context[section.placeholder] = build_subdoc(
                tpl,
                [block.model_dump() for block in section.blocks],
                style_map,
                title=section.subdoc_title,
                title_level=section.subdoc_title_level,
            )
        else:
            context[section.placeholder] = ""


def _build_individual_attachments_context(
    tpl: DocxTemplate,
    payload: Payload,
    context: Dict[str, Any],
    style_map: Dict[str, str],
) -> List[Any]:
    enabled_attachments = []
    for attachment in payload.attachments:
        flag_name = attachment.flag_name or f"ENABLE_{attachment.id.upper()}"
        context[flag_name] = bool(attachment.enabled)

        if attachment.enabled:
            enabled_attachments.append(attachment)
            context[attachment.placeholder] = build_subdoc(
                tpl,
                [block.model_dump() for block in attachment.blocks],
                style_map,
                title=attachment.title,
                title_level=attachment.title_level,
            )
        else:
            context[attachment.placeholder] = ""

    return enabled_attachments


def _build_bundle_attachments_context(
    tpl: DocxTemplate,
    payload: Payload,
    context: Dict[str, Any],
    style_map: Dict[str, str],
    enabled_attachments: List[Any],
) -> None:
    bundle = payload.attachments_bundle
    if bundle is None:
        return

    bundle_enabled = bool(bundle.enabled) and bool(enabled_attachments)
    context[bundle.flag_name] = bundle_enabled
    if not bundle_enabled:
        context[bundle.placeholder] = ""
        return

    registry = create_default_registry()
    bundle_subdoc = tpl.new_subdoc()
    include_attachment_title = bool(bundle.include_attachment_title)

    for idx, attachment in enumerate(enabled_attachments):
        if idx > 0 and bundle.page_break_between_attachments:
            registry.render(bundle_subdoc, {"type": "page_break"}, style_map)

        if include_attachment_title and attachment.title:
            registry.render(
                bundle_subdoc,
                {"type": "heading", "text": attachment.title, "level": attachment.title_level},
                style_map,
            )

        for block in attachment.blocks:
            registry.render(bundle_subdoc, block.model_dump(), style_map)

    context[bundle.placeholder] = bundle_subdoc


def _merge_paragraph_runs(docx: Any) -> None:
    """合并每个段落中被 Word proofErr/语法检查拆分的 run。

    Word 可能将 ``{{p EQUIPMENT_FEE_SUBDOC}}`` 拆成：
    ``<w:r><w:t>{{p EQUIPMENT_FEE_</w:t></w:r><w:proofErr .../><w:r><w:t>SUBDOC }}</w:t></w:r>``
    导致 Jinja2 无法识别完整占位符。此函数将同一段落内所有 <w:t> 合并为一个 run。
    """
    from lxml import etree

    NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

    body = docx._element.body
    for p in body.iter(f"{{{NS}}}p"):
        texts = []
        for t in p.iter(f"{{{NS}}}t"):
            if t.text:
                texts.append(t.text)
        if len(texts) <= 1:
            continue

        merged = "".join(texts)

        to_remove = [
            child for child in p
            if child.tag in (f"{{{NS}}}r", f"{{{NS}}}proofErr")
        ]
        for child in to_remove:
            p.remove(child)

        r = etree.SubElement(p, f"{{{NS}}}r")
        t_elem = etree.SubElement(r, f"{{{NS}}}t")
        t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        t_elem.text = merged


def render_report(
    template_path: str,
    output_path: str,
    payload: Dict[str, Any],
    *,
    strict_images: bool = False,
    check_template: bool = True,
) -> List[str]:
    logger.info("Rendering report: %s -> %s", template_path, output_path)
    normalized = normalize_payload(payload)
    payload_model, warnings = validate_payload(normalized, strict_images=strict_images)

    if check_template:
        logger.debug("Running template checks")
        ensure_template_styles(template_path, payload_model.style_map)
        ensure_template_contract(template_path, payload_model)

    tpl = DocxTemplate(template_path)
    _merge_paragraph_runs(tpl.get_docx())
    _ensure_update_fields(tpl.get_docx())
    filter_prompt_paragraphs(tpl.get_docx())
    context: Dict[str, Any] = dict(payload_model.context)
    style_map = dict(payload_model.style_map)

    _build_sections_context(tpl, payload_model, context, style_map)
    enabled_attachments = _build_individual_attachments_context(tpl, payload_model, context, style_map)
    _build_bundle_attachments_context(tpl, payload_model, context, style_map, enabled_attachments)

    tpl.render(context, autoescape=True)

    # 确保 OMML (m:) 命名空间在 document.xml 根元素上已声明，
    # 否则 formula block 插入的 <m:oMath> 会导致 XML 解析错误。
    root = tpl.docx._element
    if "m" not in root.nsmap:
        root.set(
            "{http://www.w3.org/2000/xmlns/}m",
            "http://schemas.openxmlformats.org/officeDocument/2006/math",
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    tpl.save(output_path)
    logger.info("Report saved: %s", output_path)
    return warnings


def _ensure_update_fields(docx: Any) -> None:
    """确保 Word 打开文档时自动更新域代码（SEQ、TOC 等）。"""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    settings = docx.settings.element
    existing = settings.find(qn("w:updateFields"))
    if existing is None:
        update_fields = OxmlElement("w:updateFields")
        update_fields.set(qn("w:val"), "true")
        settings.append(update_fields)


def render_grant_advanced(template_path: str, output_path: str, payload: Dict[str, Any]) -> List[str]:
    return render_report(template_path, output_path, payload)
