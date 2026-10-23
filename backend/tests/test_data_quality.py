from app.core.data_quality import find_parallel_edges
from app.core.routing import calculate_route
from app.models.schemas import Edge, IndoorMap, MapMetadata, Node, RouteRequest


def test_sample_map_flags_a12_a17_as_parallel_edges(indoor_map):
    findings = find_parallel_edges(indoor_map)
    assert len(findings) == 1
    finding = findings[0]
    assert finding.endpoints == ("E3", "T1")
    assert finding.edge_ids == ("A12", "A17")
    assert finding.overlapping_directions == (("E3", "T1"),)


def test_blocking_a12_does_not_use_reverse_only_a17_to_reach_e3(indoor_map):
    result = calculate_route(indoor_map, RouteRequest(
        map_id=indoor_map.id,
        start_node_id="S3",
        blocked_edge_ids=["A12"],
    ))
    assert result.reachable
    assert result.selected_exit_id == "E2"
    assert "A12" not in result.path_edges
    assert "A17" not in result.path_edges


def test_parallel_edge_ids_are_preserved_and_blocked_independently():
    metadata = MapMetadata(name="parallel", description="test", coordinate_note="relative")
    indoor_map = IndoorMap(
        id="parallel",
        metadata=metadata,
        nodes=[
            Node(id="S", type="START", x=0, y=0, floor=1, label="start"),
            Node(id="J", type="JUNCTION", x=1, y=0, floor=1, label="junction"),
            Node(id="E", type="EXIT", x=2, y=0, floor=1, label="exit"),
        ],
        edges=[
            Edge(id="P_SLOW", source="S", target="J", length_m=10, type="CORRIDOR"),
            Edge(id="P_FAST", source="S", target="J", length_m=5, type="CORRIDOR"),
            Edge(id="TO_EXIT", source="J", target="E", length_m=5, type="CORRIDOR"),
        ],
    )
    fastest = calculate_route(indoor_map, RouteRequest(map_id="parallel", start_node_id="S"))
    fallback = calculate_route(indoor_map, RouteRequest(
        map_id="parallel", start_node_id="S", blocked_edge_ids=["P_FAST"]
    ))
    assert fastest.path_edges == ["P_FAST", "TO_EXIT"]
    assert fallback.path_edges == ["P_SLOW", "TO_EXIT"]
    assert fastest.distance_m == 10
    assert fallback.distance_m == 15
