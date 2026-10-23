from fastapi import APIRouter, HTTPException

from app.core.comparison import compare_routes
from app.core.graph import repository
from app.core.routing import RouteInputError, calculate_route
from app.models.schemas import CompareResult, RouteRequest, RouteResult

router = APIRouter(prefix="/api/routes", tags=["routes"])


def _map_for(request: RouteRequest):
    try:
        return repository.get_map(request.map_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc


@router.post("/calculate", response_model=RouteResult)
def calculate(request: RouteRequest) -> RouteResult:
    try:
        return calculate_route(_map_for(request), request)
    except RouteInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/compare", response_model=CompareResult)
def compare(request: RouteRequest) -> CompareResult:
    try:
        return compare_routes(_map_for(request), request)
    except RouteInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
