"""Lightweight Python document generation service.

Replaces {{ key }} placeholders in .docx templates with form data values.
"""

import re
import os
from pathlib import Path

from docx import Document
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="DOCX Template Generator", version="1.0.0")


class GenerateRequest(BaseModel):
    template_path: str
    output_filename: str
    form_data: dict[str, str]


@app.get("/health")
async def health():
    return {"status": "ok"}


def replace_placeholders_in_paragraph(paragraph, form_data):
    """Replace {{ key }} placeholders in a paragraph's full text."""
    full_text = paragraph.text
    if "{{" not in full_text:
        return

    # Find all placeholder keys in this paragraph
    placeholder_pattern = re.compile(r"\{\{\s*(\w+)\s*\}\}")

    # Build replacement map
    def replacer(match):
        key = match.group(1)
        return form_data.get(key, match.group(0))

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

    # Replace placeholders in body paragraphs
    for paragraph in doc.paragraphs:
        replace_placeholders_in_paragraph(paragraph, request.form_data)

    # Replace placeholders in tables
    for table in doc.tables:
        replace_placeholders_in_table(table, request.form_data)

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
