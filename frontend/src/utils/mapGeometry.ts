import type { IndoorMap, MapEdge, MapNode } from '../types/api'

export interface EdgeGeometry {
  path: string
  midpoint: { x: number; y: number }
}

export function getViewBox(nodes: MapNode[], padding = 1.5): string {
  if (nodes.length === 0) return '0 0 1 1'
  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const width = Math.max(Math.max(...xs) - Math.min(...xs) + padding * 2, 1)
  const height = Math.max(Math.max(...ys) - Math.min(...ys) + padding * 2, 1)
  return `${minX} ${minY} ${width} ${height}`
}

export function edgeGroups(edges: MapEdge[]): Map<string, MapEdge[]> {
  const groups = new Map<string, MapEdge[]>()
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('::')
    groups.set(key, [...(groups.get(key) || []), edge])
  }
  for (const group of groups.values()) group.sort((a, b) => a.id.localeCompare(b.id))
  return groups
}

export function getEdgeGeometry(mapData: IndoorMap, edge: MapEdge): EdgeGeometry {
  const nodes = new Map(mapData.nodes.map((node) => [node.id, node]))
  const source = nodes.get(edge.source)
  const target = nodes.get(edge.target)
  if (!source || !target) return { path: '', midpoint: { x: 0, y: 0 } }

  const key = [edge.source, edge.target].sort().join('::')
  const group = edgeGroups(mapData.edges).get(key) || [edge]
  const index = group.findIndex((candidate) => candidate.id === edge.id)
  const centeredIndex = index - (group.length - 1) / 2
  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.hypot(dx, dy) || 1
  const offset = centeredIndex * 0.45
  const controlX = (source.x + target.x) / 2 - (dy / length) * offset
  const controlY = (source.y + target.y) / 2 + (dx / length) * offset
  const path = group.length > 1
    ? `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`
    : `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  return { path, midpoint: { x: controlX, y: controlY } }
}
