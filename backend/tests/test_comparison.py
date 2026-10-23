from app.core.comparison import compare_routes
from app.models.schemas import RouteRequest


def test_t12_baseline_and_empty_scenario_are_equal(indoor_map):
    result = compare_routes(indoor_map, RouteRequest(map_id=indoor_map.id, start_node_id="S1"))
    assert result.baseline.path_edges == result.scenario.path_edges
    assert result.baseline.total_time_s == result.scenario.total_time_s
    assert not result.path_changed
    assert not result.exit_changed
    assert result.distance_delta_m == 0
    assert result.total_time_delta_s == 0


def test_same_path_but_congestion_time_reason(indoor_map):
    request = RouteRequest(map_id=indoor_map.id, start_node_id="S1", congestion_delays={"A01": 1})
    result = compare_routes(indoor_map, request)
    assert not result.path_changed
    assert result.total_time_delta_s == 1
    assert "경로는 같지만" in result.change_reasons[0]


def test_unreachable_comparison_has_null_deltas(indoor_map):
    request = RouteRequest(map_id=indoor_map.id, start_node_id="S1", blocked_edge_ids=["A01", "A18"])
    result = compare_routes(indoor_map, request)
    assert not result.scenario.reachable
    assert result.distance_delta_m is None
    assert result.total_time_delta_s is None
