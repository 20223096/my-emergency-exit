from __future__ import annotations

from dataclasses import dataclass

from app.models.schemas import Edge, IndoorMap


@dataclass(frozen=True)
class ParallelEdgeFinding:
    endpoints: tuple[str, str]
    edge_ids: tuple[str, ...]
    overlapping_directions: tuple[tuple[str, str], ...]


def _directions(edge: Edge) -> set[tuple[str, str]]:
    directions = {(edge.source, edge.target)}
    if edge.bidirectional:
        directions.add((edge.target, edge.source))
    return directions


def find_parallel_edges(indoor_map: IndoorMap) -> list[ParallelEdgeFinding]:
    """Find distinct edge IDs sharing the same unordered endpoint pair.

    Findings are warnings, not schema errors: parallel edges may represent separate
    physical corridors. Overlapping directions identify routing directions covered
    by more than one edge and therefore requiring source-data review.
    """
    groups: dict[tuple[str, str], list[Edge]] = {}
    for edge in indoor_map.edges:
        endpoints = tuple(sorted((edge.source, edge.target)))
        groups.setdefault(endpoints, []).append(edge)

    findings: list[ParallelEdgeFinding] = []
    for endpoints, edges in sorted(groups.items()):
        if len(edges) < 2:
            continue
        direction_counts: dict[tuple[str, str], int] = {}
        for edge in edges:
            for direction in _directions(edge):
                direction_counts[direction] = direction_counts.get(direction, 0) + 1
        overlapping = tuple(sorted(direction for direction, count in direction_counts.items() if count > 1))
        findings.append(ParallelEdgeFinding(
            endpoints=endpoints,
            edge_ids=tuple(sorted(edge.id for edge in edges)),
            overlapping_directions=overlapping,
        ))
    return findings


def validate_control_groups(indoor_map: IndoorMap) -> list[str]:
    """Return integrity errors for physical blocking/control semantics."""
    errors: list[str] = []
    for finding in find_parallel_edges(indoor_map):
        edges = [edge for edge in indoor_map.edges if edge.id in finding.edge_ids]
        groups = {edge.physical_control_group for edge in edges}
        if None in groups or len(groups) != 1:
            errors.append(
                f"parallel edges {', '.join(finding.edge_ids)} need one shared physical_control_group"
            )
    return errors
