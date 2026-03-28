"""Lightweight Python document generation service.

Replaces {{ key }} placeholders in .docx templates with form data values.
"""

import re
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from docx import Document
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

CJK = r"\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff"

block_start_pattern = re.compile(r"\{\{\s*#([\w" + CJK + r"]+)\s*\}\}")
block_end_pattern = re.compile(r"\{\{\s*/([\w" + CJK + r"]+)\s*\}\}")
placeholder_pattern = re.compile(r"\{\{\s*([\w" + CJK + r"]+)\s*\}\}")

app = FastAPI(title="DOCX Template Generator", version="1.0.0")


class GenerateRequest(BaseModel):
    template_path: str
    output_filename: str
    form_data: dict[str, Any] = {}


@app.get("/health")
async def health():
    return {"status": "ok"}


def replace_placeholders_in_paragraph(paragraph, form_data):
    """Replace {{ key }} placeholders in a paragraph's full text."""
    full_text = paragraph.text
    if "{{" not in full_text:
        return

    # Build replacement map
    def replacer(match):
        key = match.group(1)
        value = form_data.get(key)
        if value is None:
            return match.group(0)
        return str(value)

    new_text = placeholder_pattern.sub(replacer, full_text)

    if new_text == full_text:
        return

    # Replace text while trying to preserve formatting of the first run
    if paragraph.runs:
        # Clear all runs except the first
        first_run = paragraph.runs[0]
        first_run.text = new_text
        for run in paragraph.runs[1:]:
            run.text = ""
    else:
        paragraph.text = new_text


def replace_placeholders_in_table(table, form_data):
    """Replace placeholders in table cells."""
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                replace_placeholders_in_paragraph(paragraph, form_data)


def process_table_block(table, block_name, rows_data, form_data):
    """Process {{#name}}...{{/name}} blocks in a table."""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    table_element = table._tbl

    # Find block marker rows
    start_row_idx = None
    end_row_idx = None
    for i, row in enumerate(table.rows):
        row_text = "".join(cell.text for cell in row.cells)
        if block_start_pattern.search(row_text):
            start_row_idx = i
        if block_end_pattern.search(row_text):
            end_row_idx = i
            break

    if start_row_idx is None or end_row_idx is None:
        return

    # Extract template rows (between markers, exclusive)
    tr_elements = table_element.findall(f".//{ns}tr")
    template_rows_xml = [deepcopy(tr_elements[i]) for i in range(start_row_idx + 1, end_row_idx)]

    # Remove marker rows and template rows (reverse order to preserve indices)
    for idx in reversed(range(start_row_idx, end_row_idx + 1)):
        parent = tr_elements[idx].getparent()
        if parent is not None:
            parent.remove(tr_elements[idx])

    if not rows_data:
        return

    # Find anchor for insertion
    tr_elements = table_element.findall(f".//{ns}tr")
    anchor_idx = min(start_row_idx, len(tr_elements)) if tr_elements else 0
    anchor = tr_elements[anchor_idx] if anchor_idx < len(tr_elements) else None
    insertion_point = None

    # Clone and insert rows for each data item
    for item in rows_data:
        for row_xml in template_rows_xml:
            new_row = deepcopy(row_xml)
            _replace_in_row_xml(new_row, item)
            if insertion_point is not None:
                insertion_point.addnext(new_row)
                insertion_point = new_row
            elif anchor is not None:
                anchor.addprevious(new_row)
                insertion_point = new_row
            else:
                table_element.append(new_row)
                insertion_point = new_row


def _replace_in_row_xml(row_xml, data):
    """Replace placeholders in a cloned row XML element."""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for paragraph in row_xml.findall(f".//{ns}p"):
        full_text = "".join((t.text or "") for t in paragraph.findall(f".//{ns}t"))
        if "{{" not in full_text:
            continue

        new_text = placeholder_pattern.sub(
            lambda m: str(data.get(m.group(1), m.group(0))),
            full_text
        )
        if new_text == full_text:
            continue

        runs = paragraph.findall(f"{ns}r")
        if runs:
            t_elem = runs[0].find(f"{ns}t")
            if t_elem is not None:
                t_elem.text = new_text
            for run in runs[1:]:
                for t in run.findall(f"{ns}t"):
                    t.text = ""


@app.post("/generate")
async def generate_document(request: GenerateRequest):
    template_path = Path(request.template_path)

    if not template_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Template file not found: {template_path}",
        )

    if not template_path.suffix.lower() == ".docx":
        raise HTTPException(
            status_code=400,
            detail="Only .docx files are supported",
        )

    try:
        doc = Document(str(template_path))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to open document: {e}",
        )

    simple_data: dict[str, str] = {}
    table_data: dict[str, list[dict[str, str]]] = {}
    for key, value in request.form_data.items():
        if isinstance(value, list):
            table_data[key] = value
        else:
            simple_data[key] = str(value)

    # Replace placeholders in body paragraphs
    for paragraph in doc.paragraphs:
        replace_placeholders_in_paragraph(paragraph, simple_data)

    # Collect all block names present in any table
    all_block_names: set[str] = set(table_data.keys())
    for table in doc.tables:
        for row in table.rows:
            row_text = "".join(cell.text for cell in row.cells)
            for match in block_start_pattern.finditer(row_text):
                all_block_names.add(match.group(1))

    # Replace placeholders in tables and process blocks
    for table in doc.tables:
        replace_placeholders_in_table(table, simple_data)
        for block_name in all_block_names:
            process_table_block(table, block_name, table_data.get(block_name, []), simple_data)

    # Save to a temp file and return
    output_dir = Path(os.environ.get("OUTPUT_DIR", "/tmp/docx-output"))
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / request.output_filename
    doc.save(str(output_path))

    return FileResponse(
        str(output_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=request.output_filename,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8065"))
    uvicorn.run(app, host="0.0.0.0", port=port)
