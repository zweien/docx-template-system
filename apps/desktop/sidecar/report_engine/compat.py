from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

from report_engine.blocks import DEFAULT_STYLE_MAP


LEGACY_CONTEXT_FIELDS = {
    "project_name": "PROJECT_NAME",
    "applicant_org": "APPLICANT_ORG",
    "project_leader": "PROJECT_LEADER",
}


def normalize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize legacy top-level fields into the modern payload structure."""
    normalized = deepcopy(payload)

    context = dict(normalized.get("context", {}))
    for old_key, new_key in LEGACY_CONTEXT_FIELDS.items():
        value = normalized.get(old_key)
        if value is not None and new_key not in context:
            context[new_key] = value
    normalized["context"] = context

    style_map = dict(DEFAULT_STYLE_MAP)
    style_map.update(normalized.get("style_map", {}))
    normalized["style_map"] = style_map

    normalized.setdefault("sections", [])
    normalized.setdefault("attachments", [])
    normalized.setdefault("attachments_bundle", None)

    return normalized
