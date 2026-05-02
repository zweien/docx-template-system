import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

SIDEKICK_DIR = Path(__file__).parent
sys.path.insert(0, str(SIDEKICK_DIR))            # report_engine 包
sys.path.insert(0, str(SIDEKICK_DIR / "scripts")) # parse/build 脚本

from api import parse, render, config, progress


@asynccontextmanager
async def lifespan(app):
    print("Sidecar starting...", flush=True)
    yield
    print("Sidecar shutting down...", flush=True)


app = FastAPI(title="Budget Report Sidecar", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://localhost:1421"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse.router, prefix="/api")
app.include_router(render.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(progress.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("SIDECAR_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
