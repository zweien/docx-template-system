from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from report_engine.compat import normalize_payload
from report_engine.renderer import render_report
from report_engine.style_checker import StyleCheckError, check_template_styles
from report_engine.template_checker import TemplateCheckError, check_template_contract
from report_engine.validator import PayloadValidationError, validate_payload


def _load_payload(path: str):
    text = Path(path).read_text(encoding="utf-8")
    if path.lower().endswith((".yaml", ".yml")):
        import yaml
        return yaml.safe_load(text)
    return json.loads(text)


def cmd_validate(args: argparse.Namespace) -> int:
    payload = _load_payload(args.payload)
    _, warnings = validate_payload(payload, strict_images=args.strict_images)
    print("Payload validation passed.")
    for warning in warnings:
        print(f"WARNING: {warning}")
    return 0


def cmd_check_template(args: argparse.Namespace) -> int:
    payload = _load_payload(args.payload)
    normalized = normalize_payload(payload)
    payload_model, warnings = validate_payload(normalized, strict_images=args.strict_images)

    style_result = check_template_styles(args.template, payload_model.style_map)
    contract_result = check_template_contract(args.template, payload_model)

    if style_result.missing:
        print(f"Missing styles: {', '.join(style_result.missing)}")
    if style_result.wrong_type:
        print(f"Wrong style types: {', '.join(style_result.wrong_type)}")
    if contract_result.missing_placeholders:
        print(f"Missing placeholders: {', '.join(contract_result.missing_placeholders)}")
    if contract_result.missing_flags:
        print(f"Missing flags: {', '.join(contract_result.missing_flags)}")

    for warning in warnings + style_result.warnings + contract_result.warnings:
        print(f"WARNING: {warning}")
    for note in contract_result.notes:
        print(f"NOTE: {note}")

    ok = style_result.ok and contract_result.ok
    print("Template check passed." if ok else "Template check failed.")
    return 0 if ok else 1


def cmd_render(args: argparse.Namespace) -> int:
    payload = _load_payload(args.payload)
    warnings = render_report(
        args.template,
        args.output,
        payload,
        strict_images=args.strict_images,
        check_template=not args.skip_template_checks,
    )
    print(f"Rendered: {args.output}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="report-engine")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("--payload", required=True)
    validate_parser.add_argument("--strict-images", action="store_true")
    validate_parser.set_defaults(func=cmd_validate)

    check_parser = subparsers.add_parser("check-template")
    check_parser.add_argument("--template", required=True)
    check_parser.add_argument("--payload", required=True)
    check_parser.add_argument("--strict-images", action="store_true")
    check_parser.set_defaults(func=cmd_check_template)

    render_parser = subparsers.add_parser("render")
    render_parser.add_argument("--template", required=True)
    render_parser.add_argument("--payload", required=True)
    render_parser.add_argument("--output", required=True)
    render_parser.add_argument("--strict-images", action="store_true")
    render_parser.add_argument("--skip-template-checks", action="store_true")
    render_parser.set_defaults(func=cmd_render)

    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (PayloadValidationError, StyleCheckError, TemplateCheckError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
