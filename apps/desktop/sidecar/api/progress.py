from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter()

async def progress_generator(task_id: str):
    for i in range(3):
        yield f'event: progress\ndata: {{"step":"step{i}","current":{i},"total":3}}\n\n'
        await asyncio.sleep(0.5)
    yield f'event: complete\ndata: {{"done":true}}\n\n'

@router.get("/progress")
def get_progress(task_id: str):
    return StreamingResponse(
        progress_generator(task_id),
        media_type="text/event-stream",
    )
