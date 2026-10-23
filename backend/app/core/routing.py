from __future__ import annotations

import heapq
from collections import defaultdict
from dataclasses import dataclass

from app.models.schemas import AppliedConditions, Edge, IndoorMap, NodeType, RouteRequest, RouteResult


class RouteInputError(ValueError):
    pass


@dataclass(frozen=True)
class _Arc:
    target: str
    edge: Edge


def _validate_request(indoor_map: IndoorMap, request: RouteRequest) -> None:
    nodes = {node.id: node for node in indoor_map.nodes}
    edges = {edge.id for edge in indoor_map.edges}
    exits = {node.id for node in indoor_map.nodes if node.type == NodeType.EXIT}
    if request.start_node_id not in nodes:
        raise RouteInputError(f"start_node_id '{request.start_node_id}' does not exist")
    if nodes[request.start_node_id].type != NodeType.START:
        raise RouteInputError("start_node_id must reference a START node")
    unknown_edges = (set(request.blocked_edge_ids) | set(request.congestion_delays)) - edges
    if unknown_edges:
        raise RouteInputError(f"unknown edge id(s): {', '.join(sorted(unknown_edges))}")
    unknown_exits = set(request.blocked_exit_ids) - exits
    if unknown_exits:
        raise RouteInputError(f"unknown EXIT node id(s): {', '.join(sorted(unknown_exits))}")


def calculate_route(indoor_map: IndoorMap, request: RouteRequest) -> RouteResult:
    _validate_request(indoor_map, request)
    blocked_edges = set(request.blocked_edge_ids)
    blocked_exits = set(request.blocked_exit_ids)
    available_exits = sorted(
        node.id for node in indoor_map.nodes
        if node.type == NodeType.EXIT and node.id not in blocked_exits
    )
    adjacency: dict[str, list[_Arc]] = defaultdict(list)
    for edge in indoor_map.edges:
        if edge.id in blocked_edges or edge.source in blocked_exits or edge.target in blocked_exits:
            continue
        adjacency[edge.source].append(_Arc(edge.target, edge))
        if edge.bidirectional:
            adjacency[edge.target].append(_Arc(edge.source, edge))
    for arcs in adjacency.values():
        arcs.sort(key=lambda arc: (arc.target, arc.edge.id))

    # Heap key supplies deterministic tie-breaking: time, node path, then edge path.
    heap: list[tuple[float, tuple[str, ...], tuple[str, ...], str, float]] = [
        (0.0, (request.start_node_id,), (), request.start_node_id, 0.0)
    ]
    best: dict[str, tuple[float, tuple[str, ...], tuple[str, ...]]] = {}
    candidates: list[tuple[float, str, tuple[str, ...], tuple[str, ...], float]] = []
    exit_set = set(available_exits)

    while heap:
        time_s, path_nodes, path_edges, node_id, distance_m = heapq.heappop(heap)
        key = (time_s, path_nodes, path_edges)
        if node_id in best and best[node_id] <= key:
            continue
        best[node_id] = key
        if node_id in exit_set:
            candidates.append((time_s, node_id, path_nodes, path_edges, distance_m))
            continue
        for arc in adjacency.get(node_id, []):
            if arc.target in path_nodes:
                continue
            delay = request.congestion_delays.get(arc.edge.id, 0.0)
            segment_time = arc.edge.length_m / request.walking_speed_mps + delay
            heapq.heappush(heap, (
                time_s + segment_time,
                path_nodes + (arc.target,),
                path_edges + (arc.edge.id,),
                arc.target,
                distance_m + arc.edge.length_m,
            ))

    applied = AppliedConditions(
        blocked_edge_ids=sorted(request.blocked_edge_ids),
        blocked_exit_ids=sorted(request.blocked_exit_ids),
        congestion_delays=dict(sorted(request.congestion_delays.items())),
        walking_speed_mps=request.walking_speed_mps,
    )
    if not candidates:
        return RouteResult(reachable=False, path_nodes=[], path_edges=[], selected_exit_id=None,
                           distance_m=None, movement_time_s=None, reaction_delay_s=request.reaction_delay_s,
                           total_time_s=None, applied_conditions=applied)
    movement, exit_id, nodes, edges, distance = min(candidates, key=lambda item: item[:4])
    return RouteResult(
        reachable=True,
        path_nodes=list(nodes),
        path_edges=list(edges),
        selected_exit_id=exit_id,
        distance_m=round(distance, 3),
        movement_time_s=round(movement, 3),
        reaction_delay_s=request.reaction_delay_s,
        total_time_s=round(movement + request.reaction_delay_s, 3),
        applied_conditions=applied,
    )
