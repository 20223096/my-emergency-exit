"""Deterministic FIFO capacity experiment over fixed single-person routes.

This is an assumption-driven queue model, not a validated crowd simulation.
"""
from __future__ import annotations

import heapq
import math
from collections import defaultdict
from dataclasses import dataclass

from app.core.routing import RouteInputError, calculate_route
from app.models.schemas import (
    EdgeType,
    IndoorMap,
    MultiAgentEdgeMetric,
    MultiAgentSimulationRequest,
    MultiAgentSimulationResult,
    MultiAgentTimelinePoint,
    NodeType,
    RouteRequest,
)


class MultiAgentInputError(ValueError):
    pass


@dataclass(frozen=True)
class _AgentPlan:
    start_id: str
    edge_ids: tuple[str, ...]
    exit_id: str


def _round(value: float) -> float:
    return round(value, 3)


def _validate(indoor_map: IndoorMap, request: MultiAgentSimulationRequest) -> None:
    nodes = {node.id: node for node in indoor_map.nodes}
    edges = {edge.id for edge in indoor_map.edges}
    exits = {node.id for node in indoor_map.nodes if node.type == NodeType.EXIT}
    unknown_starts = (set(request.start_counts) | set(request.start_delays_s)) - set(nodes)
    if unknown_starts:
        raise MultiAgentInputError(f"unknown start node id(s): {', '.join(sorted(unknown_starts))}")
    invalid_starts = sorted(node_id for node_id in (set(request.start_counts) | set(request.start_delays_s)) if nodes[node_id].type != NodeType.START)
    if invalid_starts:
        raise MultiAgentInputError(f"start_counts must reference START nodes: {', '.join(invalid_starts)}")
    unknown_edges = (
        set(request.blocked_edge_ids)
        | set(request.congestion_delays)
        | set(request.edge_capacity_overrides_per_s)
    ) - edges
    if unknown_edges:
        raise MultiAgentInputError(f"unknown edge id(s): {', '.join(sorted(unknown_edges))}")
    unknown_exits = set(request.blocked_exit_ids) - exits
    if unknown_exits:
        raise MultiAgentInputError(f"unknown exit id(s): {', '.join(sorted(unknown_exits))}")
    if len(request.blocked_edge_ids) != len(set(request.blocked_edge_ids)):
        raise MultiAgentInputError("blocked_edge_ids contains duplicates")
    if len(request.blocked_exit_ids) != len(set(request.blocked_exit_ids)):
        raise MultiAgentInputError("blocked_exit_ids contains duplicates")


def simulate_multi_agent(indoor_map: IndoorMap, request: MultiAgentSimulationRequest) -> MultiAgentSimulationResult:
    _validate(indoor_map, request)
    edge_by_id = {edge.id: edge for edge in indoor_map.edges}
    capacities = {
        edge.id: request.edge_capacity_overrides_per_s.get(
            edge.id,
            request.stair_capacity_per_s if edge.type == EdgeType.STAIR else request.corridor_capacity_per_s,
        )
        for edge in indoor_map.edges
    }
    plans: dict[str, _AgentPlan] = {}
    no_route_people = 0
    for start_id in sorted(request.start_counts):
        count = request.start_counts[start_id]
        if count == 0:
            continue
        try:
            route = calculate_route(indoor_map, RouteRequest(
                map_id=request.map_id,
                start_node_id=start_id,
                blocked_edge_ids=request.blocked_edge_ids,
                blocked_exit_ids=request.blocked_exit_ids,
                congestion_delays=request.congestion_delays,
                walking_speed_mps=request.walking_speed_mps,
                stair_speed_mps=request.stair_speed_mps,
            ))
        except RouteInputError as error:
            raise MultiAgentInputError(str(error)) from error
        if not route.reachable or not route.selected_exit_id:
            no_route_people += count
            continue
        plans[start_id] = _AgentPlan(start_id, tuple(route.path_edges), route.selected_exit_id)

    total = sum(request.start_counts.values())
    event_heap: list[tuple[float, int, str, int]] = []
    agent_plans: dict[str, _AgentPlan] = {}
    pending_release = 0
    sequence = 0
    for start_id in sorted(request.start_counts):
        plan = plans.get(start_id)
        if not plan:
            continue
        release = request.start_delays_s.get(start_id, 0.0)
        for ordinal in range(request.start_counts[start_id]):
            agent_id = f"{start_id}:{ordinal + 1:05d}"
            agent_plans[agent_id] = plan
            if release > request.max_elapsed_s:
                pending_release += 1
            else:
                heapq.heappush(event_heap, (release, sequence, agent_id, 0))
                sequence += 1

    next_admission: dict[str, float] = defaultdict(float)
    admissions: dict[str, list[float]] = defaultdict(list)
    wait_intervals: dict[str, list[tuple[float, float]]] = defaultdict(list)
    max_wait: dict[str, float] = defaultdict(float)
    arrivals_by_exit: dict[str, int] = defaultdict(int)
    arrival_times: list[float] = []
    waiting_at_end = 0
    in_transit_at_end = 0

    while event_heap:
        ready_time, _, agent_id, edge_index = heapq.heappop(event_heap)
        plan = agent_plans[agent_id]
        edge_id = plan.edge_ids[edge_index]
        edge = edge_by_id[edge_id]
        admission_time = max(ready_time, next_admission[edge_id])
        if admission_time - ready_time <= 1e-9:
            admission_time = ready_time
        observed_wait_end = min(admission_time, request.max_elapsed_s)
        wait_s = max(0.0, observed_wait_end - ready_time)
        max_wait[edge_id] = max(max_wait[edge_id], wait_s)
        if admission_time - ready_time > 1e-9:
            wait_intervals[edge_id].append((ready_time, observed_wait_end))
        if admission_time > request.max_elapsed_s:
            waiting_at_end += 1
            continue
        admissions[edge_id].append(admission_time)
        next_admission[edge_id] = admission_time + 1.0 / capacities[edge_id]
        speed = request.stair_speed_mps if edge.type == EdgeType.STAIR else request.walking_speed_mps
        arrival_time = admission_time + edge.length_m / speed + request.congestion_delays.get(edge_id, 0.0)
        if arrival_time > request.max_elapsed_s:
            in_transit_at_end += 1
            continue
        if edge_index == len(plan.edge_ids) - 1:
            arrivals_by_exit[plan.exit_id] += 1
            arrival_times.append(arrival_time)
        else:
            heapq.heappush(event_heap, (arrival_time, sequence, agent_id, edge_index + 1))
            sequence += 1

    def queue_at(edge_id: str, time_s: float) -> int:
        return sum(1 for start, end in wait_intervals[edge_id] if start <= time_s < end)

    relevant_edges = sorted(set(admissions) | set(wait_intervals))
    max_queues: dict[str, int] = {}
    for edge_id in relevant_edges:
        event_times = sorted({time for interval in wait_intervals[edge_id] for time in interval})
        max_queues[edge_id] = max((queue_at(edge_id, time) for time in event_times), default=0)

    arrived = len(arrival_times)
    not_arrived = total - arrived
    active_timeout = waiting_at_end + in_transit_at_end + pending_release
    if total == 0:
        end_reason = "NO_AGENTS"
        end_time = 0.0
    elif active_timeout:
        end_reason = "TIMEOUT_WITH_ACTIVE_AGENTS"
        end_time = request.max_elapsed_s
    elif no_route_people and arrived:
        end_reason = "COMPLETED_WITH_NO_ROUTE_AGENTS"
        end_time = max(arrival_times)
    elif no_route_people == total:
        end_reason = "NO_REACHABLE_ROUTES"
        end_time = 0.0
    else:
        end_reason = "ALL_REACHABLE_AGENTS_ARRIVED"
        end_time = max(arrival_times, default=0.0)

    timeline: list[MultiAgentTimelinePoint] = []
    sample_count = int(math.floor(end_time / request.time_step_s))
    sample_times = [index * request.time_step_s for index in range(sample_count + 1)]
    if not sample_times or sample_times[-1] < end_time:
        sample_times.append(end_time)
    for time_s in sample_times:
        edge_queues = {
            edge_id: count for edge_id in relevant_edges
            if (count := queue_at(edge_id, time_s)) > 0
        }
        timeline.append(MultiAgentTimelinePoint(
            time_s=_round(time_s), total_waiting=sum(edge_queues.values()), edge_queues=edge_queues,
        ))

    edge_metrics: list[MultiAgentEdgeMetric] = []
    for edge_id in relevant_edges:
        starts = admissions[edge_id]
        intervals = [later - earlier for earlier, later in zip(starts, starts[1:])]
        edge_metrics.append(MultiAgentEdgeMetric(
            edge_id=edge_id,
            capacity_per_s=_round(capacities[edge_id]),
            admitted_count=len(starts),
            max_queue_count=max_queues[edge_id],
            max_wait_s=_round(max_wait[edge_id]),
            min_admission_interval_s=_round(min(intervals)) if intervals else None,
        ))
    edge_metrics.sort(key=lambda metric: metric.edge_id)
    bottlenecks = [
        metric.edge_id for metric in sorted(
            edge_metrics, key=lambda metric: (-metric.max_queue_count, -metric.max_wait_s, metric.edge_id)
        ) if metric.max_queue_count > 0
    ]
    return MultiAgentSimulationResult(
        model_name="deterministic-fixed-route-fifo-capacity-experiment",
        model_version="0.1.0",
        assumption_notice="가정한 간선 처리용량과 고정 경로 정책을 사용하는 실험 모델이며 실제 군중 예측이 아닙니다.",
        total_initial_people=total,
        arrived_people=arrived,
        arrivals_by_exit=dict(sorted(arrivals_by_exit.items())),
        not_arrived_people=not_arrived,
        no_route_people=no_route_people,
        end_state_counts={
            "arrived": arrived,
            "waiting": waiting_at_end,
            "in_transit": in_transit_at_end,
            "pending_release": pending_release,
            "no_route": no_route_people,
        },
        last_arrival_time_s=_round(max(arrival_times)) if arrival_times else None,
        average_arrival_time_s=_round(sum(arrival_times) / arrived) if arrived else None,
        simulation_end_time_s=_round(end_time),
        end_reason=end_reason,
        edge_metrics=edge_metrics,
        timeline=timeline,
        bottleneck_edge_ids=bottlenecks,
    )
