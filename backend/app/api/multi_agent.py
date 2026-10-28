from fastapi import APIRouter, HTTPException

from app.core.graph import repository
from app.core.multi_agent import MultiAgentInputError, simulate_multi_agent
from app.models.schemas import (
    MultiAgentComparisonResult,
    MultiAgentSimulationRequest,
    MultiAgentSimulationResult,
)

router = APIRouter(prefix="/api/multi-agent", tags=["multi-agent-experiment"])


def _map_for(request: MultiAgentSimulationRequest):
    try:
        return repository.get_map(request.map_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc


@router.post("/simulate", response_model=MultiAgentSimulationResult)
def simulate(request: MultiAgentSimulationRequest) -> MultiAgentSimulationResult:
    try:
        return simulate_multi_agent(_map_for(request), request)
    except MultiAgentInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/compare", response_model=MultiAgentComparisonResult)
def compare(request: MultiAgentSimulationRequest) -> MultiAgentComparisonResult:
    indoor_map = _map_for(request)
    baseline_request = request.model_copy(update={"blocked_edge_ids": [], "blocked_exit_ids": [], "congestion_delays": {}})
    try:
        return MultiAgentComparisonResult(
            baseline=simulate_multi_agent(indoor_map, baseline_request),
            scenario=simulate_multi_agent(indoor_map, request),
        )
    except MultiAgentInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
