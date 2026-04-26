from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List
from zipfile import ZipFile

from report_engine.schema import Payload


@dataclass
class TemplateCheckResult:
    ok: bool
    missing_placeholders: List[str] = field(default_factory=list)
    missing_flags: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


class TemplateCheckError(ValueError):
    pass


def _read_template_xml(template_path: str) -> str:
    with ZipFile(template_path) as zf:
        xml_parts = []
        for name in zf.namelist():
            if name.startswith("word/") and name.endswith(".xml"):
                xml_parts.append(zf.read(name).decode("utf-8", errors="ignore"))
        return "\n".join(xml_parts)


def _extract_scalar_vars(xml: str) -> List[str]:
    """Extract scalar Jinja variables like {{VAR_NAME}} from template XML."""
    pattern = r"\{\{\s*([A-Z_][A-Z0-9_]*)\b"
    return sorted(set(re.findall(pattern, xml)))


def check_template_contract(template_path: str, payload: Payload) -> TemplateCheckResult:
    xml = _read_template_xml(template_path)

    missing_placeholders: List[str] = []
    missing_flags: List[str] = []
    warnings: List[str] = []
    notes: List[str] = []

    bundle_enabled = bool(payload.attachments_bundle and payload.attachments_bundle.enabled)
    bundle_placeholder_present = False
    bundle_flag_present = False

    if payload.attachments_bundle and payload.attachments_bundle.enabled:
        bundle = payload.attachments_bundle
        bundle_placeholder_present = bundle.placeholder in xml
        bundle_flag_present = (not bundle.flag_name) or (bundle.flag_name in xml)
        if not bundle_placeholder_present:
            missing_placeholders.append(bundle.placeholder)
        if bundle.flag_name and not bundle_flag_present:
            missing_flags.append(bundle.flag_name)

    for section in payload.sections:
        if section.placeholder not in xml:
            missing_placeholders.append(section.placeholder)
        if section.flag_name and section.flag_name not in xml:
            missing_flags.append(section.flag_name)

    for attachment in payload.attachments:
        placeholder_present = attachment.placeholder in xml
        flag_present = (not attachment.flag_name) or (attachment.flag_name in xml)

        if not placeholder_present:
            if not (bundle_enabled and bundle_placeholder_present):
                missing_placeholders.append(attachment.placeholder)
            else:
                notes.append(
                    f"Attachment placeholder {attachment.placeholder} omitted; bundled appendix slot will be used instead."
                )

        if attachment.flag_name and not flag_present:
            if not (bundle_enabled and bundle_flag_present):
                missing_flags.append(attachment.flag_name)
            else:
                notes.append(
                    f"Attachment flag {attachment.flag_name} omitted; bundled appendix flag will be used instead."
                )

    if missing_flags and not missing_placeholders:
        notes.append("Some placeholders exist without matching flags; template may use fixed titles outside condition blocks.")

    # Check for missing context variables
    scalar_vars = _extract_scalar_vars(xml)
    for var in scalar_vars:
        if var not in payload.context:
            warnings.append(f"Context variable '{var}' used in template but not provided in payload")

    return TemplateCheckResult(
        ok=not missing_placeholders and not missing_flags,
        missing_placeholders=missing_placeholders,
        missing_flags=missing_flags,
        warnings=warnings,
        notes=notes,
    )


def ensure_template_contract(template_path: str, payload: Payload) -> None:
    result = check_template_contract(template_path, payload)
    if not result.ok:
        parts = []
        if result.missing_placeholders:
            parts.append(f"missing placeholders: {', '.join(result.missing_placeholders)}")
        if result.missing_flags:
            parts.append(f"missing flags: {', '.join(result.missing_flags)}")
        raise TemplateCheckError("; ".join(parts))
