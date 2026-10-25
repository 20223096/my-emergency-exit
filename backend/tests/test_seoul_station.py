import pytest

from app.core.comparison import compare_routes
from app.core.data_quality import find_parallel_edges, validate_control_groups
from app.core.graph import repository
from app.core.routing import calculate_route
from app.models.schemas import NodeType, ProvenanceKind, RouteRequest


MAP_ID = "seoul-station-line4-prototype-v1"


@pytest.fixture(scope="module")
def seoul_map():
    return repository.get_map(MAP_ID)


def req(start="S3", **conditions):
    stair_speed = conditions.pop("stair_speed_mps", 0.8)
    return RouteRequest(
        map_id=MAP_ID, start_node_id=start, walking_speed_mps=1.2,
        stair_speed_mps=stair_speed, reaction_delay_s=5, **conditions,
    )


def test_new_map_api_and_virtual_map_regression(client):
    summaries = client.get("/api/maps").json()
    assert {item["id"] for item in summaries} >= {"virtual-station-v1", MAP_ID}
    assert client.get(f"/api/maps/{MAP_ID}").status_code == 200
    virtual = client.post("/api/routes/calculate", json={
        "map_id": "virtual-station-v1", "start_node_id": "S1"
    }).json()
    assert virtual["path_edges"] == ["A01", "A04", "A06"]


def test_starts_and_exit_candidates(seoul_map):
    starts = {node.id for node in seoul_map.nodes if node.type == NodeType.START}
    exits = {node.id: node for node in seoul_map.nodes if node.type == NodeType.EXIT}
    assert starts == {"S1", "S2", "S3"}
    assert set(exits) == {f"EXIT_{number}" for number in range(10, 15)}
    assert all(node.active_for_routing for node in exits.values())
    assert all(node.official_evacuation_exit is None for node in exits.values())


def test_node_edge_integrity_floors_and_control_units(seoul_map):
    nodes = {node.id: node for node in seoul_map.nodes}
    assert all(edge.source in nodes and edge.target in nodes for edge in seoul_map.edges)
    assert all(
        (nodes[edge.source].floor != nodes[edge.target].floor) == (edge.type.value == "STAIR")
        for edge in seoul_map.edges
    )
    assert not find_parallel_edges(seoul_map)
    assert not validate_control_groups(seoul_map)
    assert all(edge.physical_control_group for edge in seoul_map.edges)


def test_provenance_and_distance_sources_are_explicit(seoul_map):
    assert all(node.provenance is not None for node in seoul_map.nodes)
    assert all(edge.provenance in {ProvenanceKind.SIMPLIFIED, ProvenanceKind.SIMULATION_ASSUMPTION}
               for edge in seoul_map.edges)
    assert all(edge.length_source == "실험용 가정값" for edge in seoul_map.edges)


@pytest.mark.parametrize("start,exit_id,distance,total", [
    ("S1", "EXIT_10", 30, 30),
    ("S2", "EXIT_13", 37, 35.833),
    ("S3", "EXIT_11", 56, 57.5),
])
def test_baseline_for_each_start(seoul_map, start, exit_id, distance, total):
    result = calculate_route(seoul_map, req(start))
    assert (result.selected_exit_id, result.distance_m, result.total_time_s) == (exit_id, distance, total)


def test_fire_a_approach_block_and_exit_closure_are_distinct(seoul_map):
    partial = compare_routes(seoul_map, req(blocked_edge_ids=["E11_OUT"]))
    closed = compare_routes(seoul_map, req(blocked_exit_ids=["EXIT_11"]))
    for result in (partial, closed):
        assert result.scenario.reachable
        assert result.scenario.selected_exit_id == "EXIT_12"
        assert result.distance_delta_m == 4
        assert result.total_time_delta_s == 3.333
    assert partial.scenario.applied_conditions.blocked_exit_ids == []
    assert closed.scenario.applied_conditions.blocked_edge_ids == []


def test_fire_a_does_not_change_unaffected_starts(seoul_map):
    for start in ("S1", "S2"):
        result = compare_routes(seoul_map, req(start, blocked_edge_ids=["E11_OUT"]))
        assert not result.path_changed
        assert not result.exit_changed


def test_fire_b_stair_block_uses_assumed_alternative(seoul_map):
    result = compare_routes(seoul_map, req(blocked_edge_ids=["STAIR_A"]))
    assert result.scenario.reachable
    assert "STAIR_B" in result.scenario.path_edges
    assert result.scenario.selected_exit_id == "EXIT_13"
    assert result.distance_delta_m == 10
    assert result.total_time_delta_s == 9.167


def test_stair_speed_and_congestion_are_reflected(seoul_map):
    slow = calculate_route(seoul_map, req(stair_speed_mps=0.5))
    normal = calculate_route(seoul_map, req())
    assert slow.total_time_s > normal.total_time_s
    congested = compare_routes(seoul_map, req(
        blocked_edge_ids=["STAIR_A"], congestion_delays={"STAIR_B": 20}
    ))
    assert congested.scenario.total_time_s == 86.667
    assert congested.total_time_delta_s == 29.167


def test_all_platform_stairs_blocked_is_unreachable_and_reset_restores(seoul_map):
    unavailable = calculate_route(seoul_map, req(blocked_edge_ids=["STAIR_A", "STAIR_B"]))
    assert not unavailable.reachable
    assert unavailable.distance_m is None and unavailable.total_time_s is None
    reset = calculate_route(seoul_map, req())
    assert reset.reachable and reset.selected_exit_id == "EXIT_11"


def test_existing_api_payload_without_stair_speed_remains_compatible(client):
    response = client.post("/api/routes/calculate", json={
        "map_id": MAP_ID, "start_node_id": "S3", "walking_speed_mps": 1.2,
    })
    assert response.status_code == 200
    assert response.json()["applied_conditions"]["stair_speed_mps"] is None
