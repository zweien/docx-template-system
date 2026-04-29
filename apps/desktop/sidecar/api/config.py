from fastapi import APIRouter

router = APIRouter()

@router.get("/configs")
def list_configs():
    return {"configs": []}
