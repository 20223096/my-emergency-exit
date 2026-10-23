from fastapi import APIRouter

from app.core.graph import repository
from app.models.schemas import Scenario

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=list[Scenario])
def list_scenarios() -> list[Scenario]:
    return repository.list_scenarios()
