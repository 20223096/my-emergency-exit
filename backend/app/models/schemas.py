from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, model_validator


class NodeType(str, Enum):
    START = "START"
    JUNCTION = "JUNCTION"
    STAIR = "STAIR"
    EXIT = "EXIT"


class EdgeType(str, Enum):
    CORRIDOR = "CORRIDOR"
    STAIR = "STAIR"


class Node(BaseModel):
    id: str = Field(min_length=1)
    type: NodeType
    x: float
    y: float
    floor: int
    label: str = Field(min_length=1)


class Edge(BaseModel):
    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    length_m: Annotated[float, Field(gt=0)]
    type: EdgeType
    bidirectional: bool = True


class MapMetadata(BaseModel):
    name: str
    description: str
    experimental: bool = True
    coordinate_note: str


class IndoorMap(BaseModel):
    id: str = Field(min_length=1)
    metadata: MapMetadata
    nodes: list[Node]
    edges: list[Edge]

    @model_validator(mode="after")
    def validate_graph(self) -> "IndoorMap":
        node_ids = [node.id for node in self.nodes]
        edge_ids = [edge.id for edge in self.edges]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("node id must be unique")
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("edge id must be unique")
        known = set(node_ids)
        for edge in self.edges:
            if edge.source not in known or edge.target not in known:
                raise ValueError(f"edge '{edge.id}' references an unknown node")
        return self


class MapSummary(BaseModel):
    id: str
    name: str
    description: str
    experimental: bool


class ScenarioConditions(BaseModel):
    blocked_edge_ids: list[str] = Field(default_factory=list)
    blocked_exit_ids: list[str] = Field(default_factory=list)
    congestion_delays: dict[str, Annotated[float, Field(ge=0)]] = Field(default_factory=dict)


class Scenario(BaseModel):
    id: str
    name: str
    description: str
    map_id: str
    start_node_id: str
    conditions: ScenarioConditions


class RouteRequest(ScenarioConditions):
    map_id: str
    start_node_id: str
    walking_speed_mps: Annotated[float, Field(gt=0, le=10)] = 1.2
    reaction_delay_s: Annotated[float, Field(ge=0, le=3600)] = 0

    @model_validator(mode="after")
    def unique_condition_ids(self) -> "RouteRequest":
        if len(self.blocked_edge_ids) != len(set(self.blocked_edge_ids)):
            raise ValueError("blocked_edge_ids contains duplicates")
        if len(self.blocked_exit_ids) != len(set(self.blocked_exit_ids)):
            raise ValueError("blocked_exit_ids contains duplicates")
        return self


class AppliedConditions(BaseModel):
    blocked_edge_ids: list[str]
    blocked_exit_ids: list[str]
    congestion_delays: dict[str, float]
    walking_speed_mps: float


class RouteResult(BaseModel):
    reachable: bool
    path_nodes: list[str]
    path_edges: list[str]
    selected_exit_id: str | None
    distance_m: float | None
    movement_time_s: float | None
    reaction_delay_s: float
    total_time_s: float | None
    applied_conditions: AppliedConditions


class CompareResult(BaseModel):
    baseline: RouteResult
    scenario: RouteResult
    path_changed: bool
    exit_changed: bool
    distance_delta_m: float | None
    total_time_delta_s: float | None
    change_reasons: list[str]


class HealthResponse(BaseModel):
    status: str
    service: str
