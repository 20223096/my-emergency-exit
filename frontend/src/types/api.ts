export type NodeType = 'START' | 'JUNCTION' | 'STAIR' | 'EXIT'
export type EdgeType = 'CORRIDOR' | 'STAIR'
export type ProvenanceKind = 'MAP_CONFIRMED' | 'SIMPLIFIED' | 'SIMULATION_ASSUMPTION' | 'UNVERIFIED'

export interface MapNode {
  id: string
  type: NodeType
  x: number
  y: number
  floor: number
  label: string
  provenance?: ProvenanceKind | null
  source_ref?: string | null
  active_for_routing?: boolean
  official_evacuation_exit?: boolean | null
}

export interface MapEdge {
  id: string
  source: string
  target: string
  length_m: number
  type: EdgeType
  bidirectional: boolean
  provenance?: ProvenanceKind | null
  source_ref?: string | null
  length_source?: string | null
  physical_control_group?: string | null
  blockable?: boolean
}

export interface MapMetadata {
  name: string
  description: string
  experimental: boolean
  coordinate_note: string
  scope_note?: string | null
  safety_notice?: string | null
}

export interface IndoorMap {
  id: string
  metadata: MapMetadata
  nodes: MapNode[]
  edges: MapEdge[]
}

export interface MapSummary {
  id: string
  name: string
  description: string
  experimental: boolean
}

export interface ScenarioConditions {
  blocked_edge_ids: string[]
  blocked_exit_ids: string[]
  congestion_delays: Record<string, number>
}

export interface Scenario {
  id: string
  name: string
  description: string
  map_id: string
  start_node_id: string
  conditions: ScenarioConditions
  hazard_edge_ids?: string[]
  assumption_notice?: string | null
}

export interface RouteRequest extends ScenarioConditions {
  map_id: string
  start_node_id: string
  walking_speed_mps: number
  reaction_delay_s: number
  stair_speed_mps?: number | null
}

export interface AppliedConditions extends ScenarioConditions {
  walking_speed_mps: number
  stair_speed_mps?: number | null
}

export interface RouteResult {
  reachable: boolean
  path_nodes: string[]
  path_edges: string[]
  selected_exit_id: string | null
  distance_m: number | null
  movement_time_s: number | null
  reaction_delay_s: number
  total_time_s: number | null
  applied_conditions: AppliedConditions
}

export interface RouteComparison {
  baseline: RouteResult
  scenario: RouteResult
  path_changed: boolean
  exit_changed: boolean
  distance_delta_m: number | null
  total_time_delta_s: number | null
  change_reasons: string[]
}

export interface HealthResponse {
  status: string
  service: string
}

export interface MultiAgentSimulationRequest extends ScenarioConditions {
  map_id: string
  start_counts: Record<string, number>
  start_delays_s: Record<string, number>
  walking_speed_mps: number
  stair_speed_mps: number
  corridor_capacity_per_s: number
  stair_capacity_per_s: number
  edge_capacity_overrides_per_s: Record<string, number>
  time_step_s: number
  max_elapsed_s: number
}

export interface MultiAgentEdgeMetric { edge_id: string; capacity_per_s: number; admitted_count: number; max_queue_count: number; max_wait_s: number; min_admission_interval_s: number | null }
export interface MultiAgentTimelinePoint { time_s: number; total_waiting: number; edge_queues: Record<string, number> }
export interface MultiAgentSimulationResult {
  model_name: string; model_version: string; assumption_notice: string
  total_initial_people: number; arrived_people: number; arrivals_by_exit: Record<string, number>
  not_arrived_people: number; no_route_people: number; end_state_counts: Record<string, number>
  last_arrival_time_s: number | null; average_arrival_time_s: number | null; simulation_end_time_s: number; end_reason: string
  edge_metrics: MultiAgentEdgeMetric[]; timeline: MultiAgentTimelinePoint[]; bottleneck_edge_ids: string[]
}
export interface MultiAgentComparisonResult { baseline: MultiAgentSimulationResult; scenario: MultiAgentSimulationResult }
