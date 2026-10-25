import { describe, expect, it } from 'vitest'
import type { MapNode } from '../types/api'
import { countLayoutCollisions, getNodeLabelLayouts, nodeObstacles } from './mapGeometry'

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

  it('has zero static collisions on the complete Seoul prototype with hazard obstacles', () => {
    const raw = [
      ['S1', 'START', 8, 3, -1, 'S1 · 대합실 10번 출구 통로 안쪽'],
      ['S2', 'START', 1, 5, -1, 'S2 · 1호선→4호선 환승 연결 구간'],
      ['S3', 'START', 4, 8, -2, 'S3 · 4호선 승강장 회현 방향 계단 주변'],
      ['C_WEST', 'JUNCTION', 3, 5, -1, '환승 연결부 갈림길'],
      ['C_CENTER', 'JUNCTION', 5, 4, -1, '4호선 대합실 중앙'],
      ['C_EAST', 'JUNCTION', 7, 3, -1, '10·11번 방향 갈림길'],
      ['P_SOUTH', 'JUNCTION', 5, 8, -2, '회현 방향 승강장 구간'],
      ['STAIR_A_LOWER', 'STAIR', 5.5, 7.5, -2, '주 계단 승강장측'],
      ['STAIR_A_UPPER', 'STAIR', 5.5, 5, -1, '주 계단 대합실측'],
      ['STAIR_B_LOWER', 'STAIR', 3.5, 7.5, -2, '대체 계단 승강장측'],
      ['STAIR_B_UPPER', 'STAIR', 3.5, 5.5, -1, '대체 계단 대합실측'],
      ['X10_APPROACH', 'JUNCTION', 9, 2.5, -1, '10번 출구 접근부'],
      ['X11_APPROACH', 'JUNCTION', 7, 1.5, -1, '11번 출구 접근부'],
      ['X12_APPROACH', 'JUNCTION', 5, 1.5, -1, '12번 출구 접근부'],
      ['X13_APPROACH', 'JUNCTION', 2.5, 2.5, -1, '13번 출구 접근부'],
      ['X14_APPROACH', 'JUNCTION', 1, 3.5, -1, '14번 출구 접근부'],
      ['EXIT_10', 'EXIT', 10, 2, -1, '10번 출구'],
      ['EXIT_11', 'EXIT', 8, .5, -1, '11번 출구'],
      ['EXIT_12', 'EXIT', 5, .5, -1, '12번 출구'],
      ['EXIT_13', 'EXIT', 2.5, 1.3, -1, '13번 출구'],
      ['EXIT_14', 'EXIT', 0, 3, -1, '14번 출구'],
    ] as const
    const nodes: MapNode[] = raw.map(([id, type, x, y, floor, label]) => ({ id, type, x, y, floor, label }))
    const labels = new Map(nodes.map((node) => [node.id, node.label]))
    const hazards = [
      { left: 6.82, right: 8.18, top: .62, bottom: 1.68 },
      { left: 4.82, right: 6.18, top: 5.87, bottom: 6.93 },
      { left: 2.82, right: 4.18, top: 6.12, bottom: 7.18 },
      { left: 9.72, right: 12.35, top: 5.48, bottom: 5.98 },
      { left: .22, right: 3.35, top: 3.78, bottom: 4.28 },
      { left: 2.77, right: 5.55, top: 8.18, bottom: 8.68 },
    ]
    const layouts = getNodeLabelLayouts(nodes, labels, hazards)
    expect(countLayoutCollisions(layouts, [...nodeObstacles(nodes), ...hazards])).toBe(0)
    expect([...layouts.values()].some((layout) => layout.leader)).toBe(true)
  })
})
