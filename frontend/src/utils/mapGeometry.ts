import type { IndoorMap, MapEdge, MapNode } from '../types/api'

export interface EdgeGeometry {
  path: string
  midpoint: { x: number; y: number }
}

export interface NodeLabelLayout {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  width: number
}

interface LabelBox {
  left: number
  right: number
  top: number
  bottom: number
}

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/** Greedy presentation-only layout; graph coordinates and routing data stay unchanged. */
export function getNodeLabelLayouts(nodes: MapNode[], labels: Map<string, string>): Map<string, NodeLabelLayout> {
  const occupied: LabelBox[] = []
  const layouts = new Map<string, NodeLabelLayout>()
  const ordered = [...nodes].sort((a, b) => {
    const priority = (node: MapNode) => node.type === 'EXIT' ? 0 : node.type === 'START' ? 1 : node.type === 'STAIR' ? 2 : 3
    return priority(a) - priority(b) || a.y - b.y || a.x - b.x
  })

  for (const node of ordered) {
    const label = labels.get(node.id) || node.label
    const width = Math.min(Math.max(label.length * 0.135 + 0.35, 0.9), 2.7)
    const height = 0.46
    const candidates: NodeLabelLayout[] = [
      { x: node.x, y: node.y - 0.55, anchor: 'middle', width },
      { x: node.x, y: node.y + 0.78, anchor: 'middle', width },
      { x: node.x + 0.48, y: node.y + 0.08, anchor: 'start', width },
      { x: node.x - 0.48, y: node.y + 0.08, anchor: 'end', width },
    ]
    const toBox = (candidate: NodeLabelLayout): LabelBox => {
      const left = candidate.anchor === 'middle' ? candidate.x - width / 2 : candidate.anchor === 'start' ? candidate.x : candidate.x - width
      return { left, right: left + width, top: candidate.y - height * 0.72, bottom: candidate.y + height * 0.28 }
    }
    const selected = candidates.find((candidate) => !occupied.some((box) => boxesOverlap(toBox(candidate), box))) || candidates[0]
    occupied.push(toBox(selected))
    layouts.set(node.id, selected)
  }
  return layouts
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
