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
  height: number
  lines: string[]
  leader: boolean
}

export interface LayoutObstacle {
  left: number
  right: number
  top: number
  bottom: number
}

export interface LabelMeasurement {
  width: number
  height: number
}

export interface LabelBox {
  left: number
  right: number
  top: number
  bottom: number
}

export function boxesOverlap(a: LabelBox, b: LabelBox, gap = 0): boolean {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap
}

function glyphUnits(text: string): number {
  return [...text].reduce((total, character) => {
    if (/\s/.test(character)) return total + 0.36
    if (/[A-Z0-9]/.test(character)) return total + 0.64
    if (/[a-z]/.test(character)) return total + 0.54
    if (/[·→()\-]/.test(character)) return total + 0.45
    return total + 1
  }, 0)
}

function wrapLabel(text: string, maxUnits = 12): string[] {
  if (glyphUnits(text) <= maxUnits) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && glyphUnits(candidate) > maxUnits) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length > 1 ? lines : [text]
}

export function getLabelBox(layout: NodeLabelLayout): LabelBox {
  const left = layout.anchor === 'middle'
    ? layout.x - layout.width / 2
    : layout.anchor === 'start' ? layout.x : layout.x - layout.width
  return { left, right: left + layout.width, top: layout.y - layout.height + 0.12, bottom: layout.y + 0.12 }
}

export function nodeObstacles(nodes: MapNode[]): LayoutObstacle[] {
  return nodes.map((node) => ({ left: node.x - 0.39, right: node.x + 0.39, top: node.y - 0.39, bottom: node.y + 0.39 }))
}

export function countLayoutCollisions(
  layouts: Map<string, NodeLabelLayout>,
  obstacles: LayoutObstacle[],
  gap = 0.08,
): number {
  const boxes = [...layouts.values()].map(getLabelBox)
  let collisions = 0
  for (let index = 0; index < boxes.length; index += 1) {
    for (let other = index + 1; other < boxes.length; other += 1) {
      if (boxesOverlap(boxes[index], boxes[other], gap)) collisions += 1
    }
    for (const obstacle of obstacles) if (boxesOverlap(boxes[index], obstacle, gap)) collisions += 1
  }
  return collisions
}

/** Presentation-only layout; graph coordinates and routing data stay unchanged. */
export function getNodeLabelLayouts(
  nodes: MapNode[],
  labels: Map<string, string>,
  extraObstacles: LayoutObstacle[] = [],
  measurements: Map<string, LabelMeasurement> = new Map(),
): Map<string, NodeLabelLayout> {
  const occupied: LabelBox[] = []
  const fixedObstacles = [...nodeObstacles(nodes), ...extraObstacles]
  const layouts = new Map<string, NodeLabelLayout>()
  const ordered = [...nodes].sort((a, b) => {
    const priority = (node: MapNode) => node.type === 'START' ? 0 : node.type === 'EXIT' ? 1 : node.type === 'STAIR' ? 2 : 3
    return priority(a) - priority(b) || a.y - b.y || a.x - b.x
  })

  for (const node of ordered) {
    const label = labels.get(node.id) || node.label
    const lines = wrapLabel(label)
    const measured = measurements.get(node.id)
    const width = measured?.width ?? Math.max(1, ...lines.map((line) => glyphUnits(line) * 0.245 + 0.34))
    const height = measured?.height ?? (lines.length * 0.31 + 0.24)
    const make = (x: number, y: number, anchor: NodeLabelLayout['anchor'], leader: boolean): NodeLabelLayout => (
      { x, y, anchor, width, height, lines, leader }
    )
    const candidates: NodeLabelLayout[] = [
      make(node.x, node.y - 0.62, 'middle', false),
      make(node.x, node.y + 0.62 + height, 'middle', false),
      make(node.x + 0.55, node.y + height / 2, 'start', false),
      make(node.x - 0.55, node.y + height / 2, 'end', false),
    ]
    for (const radius of [1, 1.35, 1.7, 2.1, 2.55, 3.05, 3.55, 4.05]) {
      candidates.push(
        make(node.x, node.y - radius, 'middle', true),
        make(node.x, node.y + radius + height, 'middle', true),
        make(node.x + radius, node.y + height / 2, 'start', true),
        make(node.x - radius, node.y + height / 2, 'end', true),
        make(node.x + radius * 0.72, node.y - radius * 0.72, 'start', true),
        make(node.x - radius * 0.72, node.y - radius * 0.72, 'end', true),
        make(node.x + radius * 0.72, node.y + radius * 0.72 + height, 'start', true),
        make(node.x - radius * 0.72, node.y + radius * 0.72 + height, 'end', true),
      )
    }
    const isClear = (candidate: NodeLabelLayout) => {
      const box = getLabelBox(candidate)
      return !occupied.some((item) => boxesOverlap(box, item, 0.1))
        && !fixedObstacles.some((item) => boxesOverlap(box, item, 0.1))
    }
    const selected = candidates.find(isClear) || candidates.reduce((best, candidate) => {
      const collisionCount = [...occupied, ...fixedObstacles]
        .filter((item) => boxesOverlap(getLabelBox(candidate), item, 0.1)).length
      const bestCount = [...occupied, ...fixedObstacles]
        .filter((item) => boxesOverlap(getLabelBox(best), item, 0.1)).length
      return collisionCount < bestCount ? candidate : best
    })
    occupied.push(getLabelBox(selected))
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
