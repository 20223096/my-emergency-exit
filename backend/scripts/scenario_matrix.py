"""Print the documented Seoul Station prototype scenario matrix as JSON."""
from __future__ import annotations

import json

from app.core.comparison import compare_routes
from app.core.graph import repository
from app.models.schemas import RouteRequest

MAP_ID = "seoul-station-line4-prototype-v1"
MAP = repository.get_map(MAP_ID)


def run(name: str, start: str, *, blocked_edges=None, blocked_exits=None,
        delays=None, walk=1.2, stair=0.8, reaction=0):
    request = RouteRequest(
        map_id=MAP_ID,
        start_node_id=start,
        blocked_edge_ids=blocked_edges or [],
        blocked_exit_ids=blocked_exits or [],
        congestion_delays=delays or {},
        walking_speed_mps=walk,
        stair_speed_mps=stair,
        reaction_delay_s=reaction,
    )
    result = compare_routes(MAP, request)
    scenario = result.scenario
    return {
        "name": name,
        "start": start,
        "inputs": {
            "blocked_edges": request.blocked_edge_ids,
            "blocked_exits": request.blocked_exit_ids,
            "fixed_delays_s": request.congestion_delays,
            "walking_speed_mps": walk,
            "stair_speed_mps": stair,
            "reaction_delay_s": reaction,
        },
        "reachable": scenario.reachable,
        "exit": scenario.selected_exit_id,
        "distance_m": scenario.distance_m,
        "simulated_time_s": scenario.total_time_s,
        "baseline_exit": result.baseline.selected_exit_id,
        "detour_m": result.distance_delta_m,
        "added_time_s": result.total_time_delta_s,
        "path_edges": scenario.path_edges,
        "change_reasons": result.change_reasons,
    }


rows = []
for start in ("S1", "S2", "S3"):
    rows.extend([
        run("기본 조건", start),
        run("화재 A · 11번 접근 통로 차단", start, blocked_edges=["E11_OUT"]),
        run("화재 B · 승강장 주 계단 차단", start, blocked_edges=["STAIR_A"]),
    ])

baseline_by_start = {start: run("lookup", start) for start in ("S1", "S2", "S3")}
for delay in (0, 10, 20):
    edge = baseline_by_start["S3"]["path_edges"][0]
    rows.append(run(f"S3 고정 지연 {delay}초", "S3", delays={edge: delay}))

rows.extend([
    run("S3 저속", "S3", walk=0.8, stair=0.5),
    run("S3 고속", "S3", walk=1.6, stair=1.0),
    run("S3 출발 지연 15초", "S3", reaction=15),
    run("S3 출발 지연 30초", "S3", reaction=30),
    run("S3 11번 출구 폐쇄", "S3", blocked_exits=["EXIT_11"]),
    run("S3 모든 유효 계단 차단", "S3", blocked_edges=["STAIR_A", "STAIR_B"]),
])

print(json.dumps({
    "map_id": MAP_ID,
    "map_version": "seoul-station-line4-prototype-v1",
    "scenario_data": "backend/app/data/scenarios.json@working-tree",
    "rows": rows,
}, ensure_ascii=False, indent=2))
