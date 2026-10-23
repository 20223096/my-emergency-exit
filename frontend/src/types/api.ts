export type NodeType = 'START' | 'JUNCTION' | 'STAIR' | 'EXIT'
export type EdgeType = 'CORRIDOR' | 'STAIR'

export interface MapNode {
  id: string
  type: NodeType
  x: number
  y: number
  floor: number
  label: string
}

export interface MapEdge {
  id: string
  source: string
  target: string
  length_m: number
  type: EdgeType
  bidirectional: boolean
}

export interface MapMetadata {
  name: string
  description: string
  experimental: boolean
  coordinate_note: string
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
}

export interface RouteRequest extends ScenarioConditions {
  map_id: string
  start_node_id: string
  walking_speed_mps: number
  reaction_delay_s: number
}

export interface AppliedConditions extends ScenarioConditions {
  walking_speed_mps: number
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
