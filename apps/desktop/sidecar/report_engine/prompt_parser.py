from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from docx import Document

logger = logging.getLogger("report_engine")

PROMPT_PREFIX = "[[PROMPT:"
PROMPT_SUFFIX = "]]"


def _parse_prompt_text(text: str) -> Optional[Dict[str, Any]]:
    """Parse a single PROMPT annotation text.

    Expected format: [[PROMPT: target: prompt text | mode=xxx]]

    Returns a dict with target, prompt, mode, level, or None if invalid.
    """
    stripped = text.strip()
    if not stripped.startswith(PROMPT_PREFIX):
        return None
    if not stripped.endswith(PROMPT_SUFFIX):
        return None

    inner = stripped[len(PROMPT_PREFIX) : -len(PROMPT_SUFFIX)].strip()

    if ":" not in inner:
        return None

    target, prompt = inner.split(":", 1)
    target = target.strip()
    prompt = prompt.strip()

    if not target:
        return None

    # Extract optional mode=xxx from the end
    mode = "auto"
    mode_match = re.search(r"\|\s*mode=(\w+)\s*$", prompt)
    if mode_match:
        mode_value = mode_match.group(1)
        if mode_value in ("auto", "interactive"):
            mode = mode_value
        else:
            logger.warning(
                "Invalid prompt mode '%s', defaulting to 'auto'", mode_value
            )
            mode = "auto"
        prompt = prompt[: mode_match.start()].strip()

    level = "paragraph" if "." in target else "section"

    return {
        "target": target,
        "prompt": prompt,
        "mode": mode,
        "level": level,
    }


def extract_prompts(doc: Document) -> List[Dict[str, Any]]:
    """Scan all paragraphs in a docx Document and return list of parsed prompts."""
    prompts = []
    for para in doc.paragraphs:
        parsed = _parse_prompt_text(para.text)
        if parsed is not None:
            prompts.append(parsed)
    return prompts


def filter_prompt_paragraphs(doc: Document) -> int:
    """Remove all PROMPT paragraphs from the document.

    Deletes from XML from back to front to avoid index issues.
    Returns count of removed paragraphs.
    """
    body = doc.element.body
    paragraphs = list(body.findall(".//w:p", namespaces=doc.element.nsmap))

    removed = 0
    # Iterate from back to front to avoid index shift issues
    for p_elem in reversed(paragraphs):
        text = "".join(
            t.text or "" for t in p_elem.findall(".//w:t", namespaces=doc.element.nsmap)
        )
        if text.strip().startswith(PROMPT_PREFIX) and text.strip().endswith(PROMPT_SUFFIX):
            body.remove(p_elem)
            removed += 1

    if removed:
        logger.debug("Removed %d prompt paragraph(s) from document", removed)

    return removed
