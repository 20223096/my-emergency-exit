"""Print the documented assumption-driven multi-person experiment matrix."""
from __future__ import annotations

import json

from app.core.graph import repository
from app.core.multi_agent import simulate_multi_agent
from app.models.schemas import MultiAgentSimulationRequest

MAP_ID = "seoul-station-line4-prototype-v1"
INDOOR_MAP = repository.get_map(MAP_ID)


def run(name, counts, **updates):
    values = dict(
        map_id=MAP_ID, start_counts=counts, walking_speed_mps=1.2, stair_speed_mps=0.8,
        corridor_capacity_per_s=2.0, stair_capacity_per_s=1.0,
        time_step_s=5.0, max_elapsed_s=3600.0,
    )
    values.update(updates)
    request = MultiAgentSimulationRequest(**values)
    result = simulate_multi_agent(INDOOR_MAP, request)
    metrics = sorted(result.edge_metrics, key=lambda item: (-item.max_queue_count, -item.max_wait_s, item.edge_id))
    return {
        "name": name,
        "inputs": request.model_dump(),
        "arrived": result.arrived_people,
        "arrivals_by_exit": result.arrivals_by_exit,
        "not_arrived": result.not_arrived_people,
        "no_route": result.no_route_people,
        "last_arrival_s": result.last_arrival_time_s,
        "average_arrival_s": result.average_arrival_time_s,
        "end_reason": result.end_reason,
        "top_bottlenecks": [
            {"edge_id": item.edge_id, "max_queue": item.max_queue_count, "max_wait_s": item.max_wait_s}
            for item in metrics[:3] if item.max_queue_count > 0
        ],
        "end_state_counts": result.end_state_counts,
    }


rows = [
    run("S3 1명 기본", {"S3": 1}),
    run("S3 20명 기본", {"S3": 20}),
    run("S3 100명 기본", {"S3": 100}),
    run("S3 300명 기본", {"S3": 300}),
    run("S3 100명 계단 용량 0.5", {"S3": 100}, stair_capacity_per_s=0.5),
    run("S3 100명 계단 용량 2.0", {"S3": 100}, stair_capacity_per_s=2.0),
    run("S3 100명 화재 A", {"S3": 100}, blocked_edge_ids=["E11_OUT"]),
    run("S3 100명 화재 B", {"S3": 100}, blocked_edge_ids=["STAIR_A"]),
    run("S3 100명 계단 A+B 차단", {"S3": 100}, blocked_edge_ids=["STAIR_A", "STAIR_B"]),
    run("S1 20명 + S3 20명 A+B 차단", {"S1": 20, "S3": 20}, blocked_edge_ids=["STAIR_A", "STAIR_B"]),
    run("S3 300명 60초 timeout", {"S3": 300}, max_elapsed_s=60),
]

print(json.dumps({
    "map_id": MAP_ID,
    "model": "deterministic-fixed-route-fifo-capacity-experiment@0.1.0",
    "notice": "All capacities and times are assumption-driven experiment outputs, not validated crowd predictions.",
    "rows": rows,
}, ensure_ascii=False, indent=2))
