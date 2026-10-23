import pytest
from pydantic import ValidationError

from app.core.routing import RouteInputError, calculate_route
from app.models.schemas import Edge, IndoorMap, MapMetadata, Node, RouteRequest


def request(**overrides):
    values = {"map_id": "virtual-station-v1", "start_node_id": "S1"}
    values.update(overrides)
    return RouteRequest(**values)


def test_t01_baseline_reaches_exit(indoor_map):
    result = calculate_route(indoor_map, request())
    assert result.reachable
    assert result.path_nodes[0] == "S1"
    assert result.selected_exit_id in {"E1", "E2", "E3"}


def test_t02_block_baseline_edge_finds_detour(indoor_map):
    baseline = calculate_route(indoor_map, request())
    blocked = baseline.path_edges[0]
    result = calculate_route(indoor_map, request(blocked_edge_ids=[blocked]))
    assert result.reachable
    assert blocked not in result.path_edges
    assert result.path_edges != baseline.path_edges


def test_t03_closed_exit_selects_another(indoor_map):
    baseline = calculate_route(indoor_map, request())
    result = calculate_route(indoor_map, request(blocked_exit_ids=[baseline.selected_exit_id]))
    assert result.reachable
    assert result.selected_exit_id != baseline.selected_exit_id


def test_t04_congestion_is_reflected(indoor_map):
    baseline = calculate_route(indoor_map, request())
    edge = baseline.path_edges[-1]
    result = calculate_route(indoor_map, request(congestion_delays={edge: 5}))
    assert result.total_time_s >= baseline.total_time_s
    assert result.path_edges != baseline.path_edges or result.total_time_s == baseline.total_time_s + 5


def test_t05_block_and_congestion_together(indoor_map):
    result = calculate_route(indoor_map, request(blocked_edge_ids=["A04"], congestion_delays={"A05": 7}))
    assert result.reachable
    assert "A04" not in result.path_edges
    assert result.applied_conditions.congestion_delays == {"A05": 7.0}


def test_t06_all_routes_blocked(indoor_map):
    result = calculate_route(indoor_map, request(blocked_edge_ids=["A01", "A18"]))
    assert not result.reachable


def test_t07_deterministic_result(indoor_map):
    results = [calculate_route(indoor_map, request()).model_dump() for _ in range(10)]
    assert all(item == results[0] for item in results)


def test_t08_speed_changes_time(indoor_map):
    slow = calculate_route(indoor_map, request(walking_speed_mps=1.0))
    fast = calculate_route(indoor_map, request(walking_speed_mps=2.0))
    assert fast.movement_time_s == pytest.approx(slow.movement_time_s / 2, abs=0.002)


def test_t09_reaction_delay_added_once(indoor_map):
    base = calculate_route(indoor_map, request(reaction_delay_s=0))
    delayed = calculate_route(indoor_map, request(reaction_delay_s=13))
    assert delayed.movement_time_s == base.movement_time_s
    assert delayed.total_time_s == base.total_time_s + 13


def test_t10_invalid_inputs(indoor_map):
    with pytest.raises(ValidationError):
        Edge(id="bad", source="S1", target="J1", length_m=-1, type="CORRIDOR")
    with pytest.raises(ValidationError):
        request(congestion_delays={"A01": -1})
    with pytest.raises(RouteInputError, match="start_node_id"):
        calculate_route(indoor_map, request(start_node_id="UNKNOWN"))
    with pytest.raises(RouteInputError, match="unknown edge"):
        calculate_route(indoor_map, request(blocked_edge_ids=["UNKNOWN"]))


def test_t10_duplicate_and_unknown_node_validation():
    meta = MapMetadata(name="test", description="test", coordinate_note="relative")
    nodes = [Node(id="A", type="START", x=0, y=0, floor=1, label="A")]
    with pytest.raises(ValidationError, match="node id must be unique"):
        IndoorMap(id="x", metadata=meta, nodes=nodes * 2, edges=[])
    with pytest.raises(ValidationError, match="unknown node"):
        IndoorMap(id="x", metadata=meta, nodes=nodes,
                  edges=[Edge(id="x", source="A", target="B", length_m=1, type="CORRIDOR")])


def test_t11_shortest_of_multiple_paths(indoor_map):
    result = calculate_route(indoor_map, request())
    assert result.path_edges == ["A01", "A04", "A06"]
    assert result.distance_m == 60


def test_t13_unreachable_null_fields(indoor_map):
    result = calculate_route(indoor_map, request(blocked_edge_ids=["A01", "A18"]))
    assert result.selected_exit_id is None
    assert result.distance_m is None
    assert result.movement_time_s is None
    assert result.total_time_s is None
    assert result.path_nodes == []


def test_t14_closed_exit_cannot_be_intermediate(indoor_map):
    result = calculate_route(indoor_map, request(blocked_exit_ids=["E1", "E2"]))
    assert result.reachable
    assert result.selected_exit_id == "E3"
    assert "E1" not in result.path_nodes and "E2" not in result.path_nodes


def test_t15_one_way_reverse_is_forbidden():
    meta = MapMetadata(name="one-way", description="test", coordinate_note="relative")
    graph = IndoorMap(
        id="one-way", metadata=meta,
        nodes=[
            Node(id="S", type="START", x=0, y=0, floor=1, label="start"),
            Node(id="E", type="EXIT", x=1, y=0, floor=1, label="exit"),
        ],
        edges=[Edge(id="ONE", source="E", target="S", length_m=1, type="CORRIDOR", bidirectional=False)],
    )
    result = calculate_route(graph, RouteRequest(map_id="one-way", start_node_id="S"))
    assert not result.reachable
