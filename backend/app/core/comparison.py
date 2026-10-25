from __future__ import annotations

from app.core.routing import calculate_route
from app.models.schemas import CompareResult, IndoorMap, RouteRequest


def compare_routes(indoor_map: IndoorMap, request: RouteRequest) -> CompareResult:
    baseline_request = RouteRequest(
        map_id=request.map_id,
        start_node_id=request.start_node_id,
        walking_speed_mps=request.walking_speed_mps,
        reaction_delay_s=request.reaction_delay_s,
        stair_speed_mps=request.stair_speed_mps,
    )
    baseline = calculate_route(indoor_map, baseline_request)
    scenario = calculate_route(indoor_map, request)
    path_changed = baseline.path_edges != scenario.path_edges
    exit_changed = baseline.selected_exit_id != scenario.selected_exit_id
    distance_delta = _delta(scenario.distance_m, baseline.distance_m)
    time_delta = _delta(scenario.total_time_s, baseline.total_time_s)
    reasons = _change_reasons(request, baseline, scenario, path_changed, exit_changed, time_delta)
    return CompareResult(
        baseline=baseline,
        scenario=scenario,
        path_changed=path_changed,
        exit_changed=exit_changed,
        distance_delta_m=distance_delta,
        total_time_delta_s=time_delta,
        change_reasons=reasons,
    )


def _delta(scenario: float | None, baseline: float | None) -> float | None:
    if scenario is None or baseline is None:
        return None
    return round(scenario - baseline, 3)


def _change_reasons(request, baseline, scenario, path_changed, exit_changed, time_delta) -> list[str]:
    if not scenario.reachable:
        return ["설정된 차단 및 출구 폐쇄 조건으로 사용 가능한 경로가 없습니다."]
    reasons: list[str] = []
    if request.blocked_edge_ids and path_changed:
        reasons.append("통로 차단으로 기본 경로를 이용할 수 없어 경로가 변경되었습니다.")
    if request.blocked_exit_ids and exit_changed:
        reasons.append("출구 폐쇄로 선택 출구가 변경되었습니다.")
    if request.congestion_delays:
        congested_on_baseline = set(request.congestion_delays) & set(baseline.path_edges)
        if path_changed and congested_on_baseline:
            reasons.append("기본 경로의 혼잡 지연을 피하기 위해 경로가 변경되었습니다.")
        elif not path_changed and time_delta and time_delta > 0:
            reasons.append("경로는 같지만 혼잡 추가 지연으로 이동시간이 증가했습니다.")
    if not reasons:
        reasons.append("입력 조건이 최적 경로와 모의 이동시간에 변화를 주지 않았습니다.")
    return reasons
