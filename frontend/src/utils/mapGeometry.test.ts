import { describe, expect, it } from 'vitest'
import type { MapNode } from '../types/api'
import { getNodeLabelLayouts } from './mapGeometry'

describe('node label layout', () => {
  it('moves adjacent labels to different candidate positions', () => {
    const nodes: MapNode[] = [
      { id: 'EXIT_11', type: 'EXIT', x: 1, y: 1, floor: -1, label: '11번 출구' },
      { id: 'EXIT_12', type: 'EXIT', x: 1.25, y: 1, floor: -1, label: '12번 출구' },
      { id: 'S1', type: 'START', x: 1.5, y: 1, floor: -1, label: '대합실 출발점' },
    ]
    const labels = new Map(nodes.map((node) => [node.id, node.label]))
    const layouts = getNodeLabelLayouts(nodes, labels)
    const positions = nodes.map((node) => {
      const layout = layouts.get(node.id)
      return `${layout?.x}:${layout?.y}:${layout?.anchor}`
    })
    expect(new Set(positions).size).toBe(nodes.length)
  })
})
