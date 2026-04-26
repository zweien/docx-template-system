import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent / "src"))
from report_engine.renderer import render_report
from report_engine.template_parser import parse_template

app = FastAPI(title="Report Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParseRequest(BaseModel):
    template_path: str


class RenderRequest(BaseModel):
    template_path: str
    payload: dict[str, Any]
    output_filename: str = "report.docx"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse-template")
async def parse_template_endpoint(req: ParseRequest):
    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")
    structure, warnings = parse_template(req.template_path)
    return {"structure": structure, "warnings": warnings}


@app.post("/render")
async def render_endpoint(req: RenderRequest):
    from fastapi.responses import FileResponse

    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    output_path = tempfile.mktemp(suffix=".docx")
    try:
        render_report(req.template_path, req.payload, output_path, check_template=False)
        filename = req.output_filename or "report.docx"
        return FileResponse(output_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    except Exception as e:
        if Path(output_path).exists():
            Path(output_path).unlink()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8066"))
    uvicorn.run(app, host="0.0.0.0", port=port)
