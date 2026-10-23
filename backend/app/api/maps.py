from fastapi import APIRouter, HTTPException

from app.core.graph import repository
from app.models.schemas import IndoorMap, MapSummary

router = APIRouter(prefix="/api/maps", tags=["maps"])


@router.get("", response_model=list[MapSummary])
def list_maps() -> list[MapSummary]:
    return repository.list_maps()


@router.get("/{map_id}", response_model=IndoorMap)
def get_map(map_id: str) -> IndoorMap:
    try:
        return repository.get_map(map_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc
