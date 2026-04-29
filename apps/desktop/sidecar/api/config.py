from fastapi import APIRouter

router = APIRouter()

# TODO: Implement actual config persistence (read from user config dir)
@router.get("/configs")
def list_configs():
    return {"configs": []}
