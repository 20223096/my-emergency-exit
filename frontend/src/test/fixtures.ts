import type { IndoorMap, RouteResult, Scenario } from '../types/api'

export const mapFixture: IndoorMap = {
  id: 'virtual-station-v1',
  metadata: { name: '가상 지도', description: 'test', experimental: true, coordinate_note: 'relative' },
  nodes: [
    { id: 'S1', type: 'START', x: 0, y: 0, floor: 1, label: '출발점' },
    { id: 'J1', type: 'JUNCTION', x: 4, y: 0, floor: 1, label: '갈림길' },
    { id: 'T1', type: 'STAIR', x: 4, y: 3, floor: 2, label: '계단' },
    { id: 'E1', type: 'EXIT', x: 8, y: 0, floor: 1, label: '출구 1' },
    { id: 'E3', type: 'EXIT', x: 8, y: 3, floor: 2, label: '출구 3' },
  ],
  edges: [
    { id: 'A01', source: 'S1', target: 'J1', length_m: 18, type: 'CORRIDOR', bidirectional: true },
    { id: 'A06', source: 'J1', target: 'E1', length_m: 22, type: 'CORRIDOR', bidirectional: true },
    { id: 'A12', source: 'T1', target: 'E3', length_m: 21, type: 'CORRIDOR', bidirectional: true },
    { id: 'A17', source: 'E3', target: 'T1', length_m: 18, type: 'CORRIDOR', bidirectional: false },
  ],
}

export const routeFixture: RouteResult = {
  reachable: true,
  path_nodes: ['S1', 'J1', 'E1'],
  path_edges: ['A01', 'A06'],
  selected_exit_id: 'E1',
  distance_m: 40,
  movement_time_s: 33.333,
  reaction_delay_s: 5,
  total_time_s: 38.333,
  applied_conditions: {
    blocked_edge_ids: [], blocked_exit_ids: [], congestion_delays: {}, walking_speed_mps: 1.2,
  },
}

export const unreachableFixture: RouteResult = {
  ...routeFixture,
  reachable: false,
  path_nodes: [],
  path_edges: [],
  selected_exit_id: null,
  distance_m: null,
  movement_time_s: null,
  total_time_s: null,
}

export const scenarioFixture: Scenario = {
  id: 'block-main', name: '통로 차단', description: 'A01 차단', map_id: mapFixture.id, start_node_id: 'S1',
  conditions: { blocked_edge_ids: ['A01'], blocked_exit_ids: ['E1'], congestion_delays: { A06: 10 } },
}
