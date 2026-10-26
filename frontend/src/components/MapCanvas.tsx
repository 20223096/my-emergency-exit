import { useLayoutEffect, useRef, useState } from 'react'
import type { IndoorMap, RouteResult } from '../types/api'
import { getEdgeGeometry, getNodeLabelLayouts, getViewBox, type LabelMeasurement, type LayoutObstacle } from '../utils/mapGeometry'

function displayNodeLabel(id: string, label: string): string {
  const exitMatch = id.match(/^EXIT_(\d+)$/)
  if (exitMatch) return `${exitMatch[1]}번 출구`
  if (/^S\d+$/.test(id)) return `${id} · ${label}`
  return label
}

interface MapCanvasProps {
  mapData: IndoorMap
  baselineRoute?: RouteResult | null
  scenarioRoute?: RouteResult | null
  blockedEdgeIds?: string[]
  blockedExitIds?: string[]
  congestionDelays?: Record<string, number>
  selectedStartNodeId?: string
  floor?: number | null
  hazardEdgeIds?: string[]
}

export function MapCanvas({
  mapData,
  baselineRoute = null,
  scenarioRoute = null,
  blockedEdgeIds = [],
  blockedExitIds = [],
  congestionDelays = {},
  selectedStartNodeId,
  floor = null,
  hazardEdgeIds = [],
}: MapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [labelMeasurements, setLabelMeasurements] = useState<Map<string, LabelMeasurement>>(new Map())
  const visibleNodeIds = new Set(
    mapData.nodes.filter((node) => floor === null || node.floor === floor).map((node) => node.id),
  )
  const visibleNodes = mapData.nodes.filter((node) => visibleNodeIds.has(node.id))
  const visibleEdges = mapData.edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  )
  const baselineEdges = new Set(baselineRoute?.path_edges || [])
  const scenarioEdges = new Set(scenarioRoute?.path_edges || [])
  const blockedEdges = new Set(blockedEdgeIds)
  const blockedExits = new Set(blockedExitIds)
  const hazardEdges = new Set(hazardEdgeIds)
  const displayLabels = new Map(visibleNodes.map((node) => [node.id, displayNodeLabel(node.id, node.label)]))
  const isSeoulPrototype = mapData.id === 'seoul-station-line4-prototype-v1'
  const statusObstacles: LayoutObstacle[] = visibleEdges.flatMap((edge) => {
    if (!hazardEdges.has(edge.id) && !blockedEdges.has(edge.id) && !(edge.id in congestionDelays)) return []
    const { midpoint } = getEdgeGeometry(mapData, edge)
    const obstacles: LayoutObstacle[] = []
    if (hazardEdges.has(edge.id)) obstacles.push({ left: midpoint.x - 0.68, right: midpoint.x + 0.68, top: midpoint.y - 0.38, bottom: midpoint.y + 0.68 })
    if (blockedEdges.has(edge.id)) obstacles.push({ left: midpoint.x - 0.3, right: midpoint.x + 0.3, top: midpoint.y - 0.3, bottom: midpoint.y + 0.3 })
    if (edge.id in congestionDelays) obstacles.push({ left: midpoint.x - 0.48, right: midpoint.x + 0.48, top: midpoint.y - 0.58, bottom: midpoint.y - 0.08 })
    return obstacles
  })
  const zoneLabelObstacles: LayoutObstacle[] = isSeoulPrototype ? [
    { left: 8.72, right: 11.55, top: 5.48, bottom: 5.98 },
    { left: 0.22, right: 3.25, top: 3.78, bottom: 4.28 },
    { left: 2.77, right: 5.45, top: 8.18, bottom: 8.68 },
  ] : []
  const labelLayouts = getNodeLabelLayouts(
    visibleNodes, displayLabels, [...statusObstacles, ...zoneLabelObstacles], labelMeasurements,
  )

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measured = new Map<string, LabelMeasurement>()
    svg.querySelectorAll<SVGGElement>('[data-label-id]').forEach((group) => {
      const text = group.querySelector<SVGTextElement>('text')
      if (!text || typeof text.getBBox !== 'function') return
      const box = text.getBBox()
      measured.set(group.dataset.labelId || '', { width: box.width + 0.34, height: box.height + 0.24 })
    })
    if (!measured.size) return
    const changed = [...measured].some(([id, size]) => {
      const current = labelMeasurements.get(id)
      return !current || Math.abs(current.width - size.width) > 0.02 || Math.abs(current.height - size.height) > 0.02
    })
    if (changed) setLabelMeasurements(measured)
  }, [mapData.id, floor, visibleNodes.length, hazardEdgeIds.join('|'), blockedEdgeIds.join('|'), labelMeasurements])

  return (
    <section className="map-panel" aria-label="실험용 공간 지도">
      <div className="legend" aria-label="지도 범례">
        <span className="legend-start">출발점</span>
        <span className="legend-exit">출구 후보</span>
        <span className="legend-selected-exit">선택 출구</span>
        <span className="legend-baseline">기본 경로</span>
        <span className="legend-scenario">변경 경로</span>
        <span className="legend-blocked">차단</span>
        <span className="legend-congested">혼잡</span>
        <span className="legend-stair">계단/층 연결</span>
        <span className="legend-fire">화재 가정 위치</span>
      </div>
      <div className="map-viewport">
        <svg
          ref={svgRef}
          className="map-canvas"
          viewBox={getViewBox(visibleNodes, isSeoulPrototype ? 2.75 : 1.8)}
          role="img"
          aria-label={`${mapData.metadata.name}${floor === null ? ' 전체 층' : ` ${floor}층`}`}
          preserveAspectRatio="xMidYMid meet"
        >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="direction-arrow" />
          </marker>
          <pattern id="stair-pattern" width="0.22" height="0.22" patternUnits="userSpaceOnUse">
            <path d="M 0 .18 H .14 V .08 H .22" fill="none" stroke="#79549d" strokeWidth=".035" />
          </pattern>
        </defs>

        {isSeoulPrototype && (
          <g className="map-zones" aria-label="단순화 공간 구역">
            <rect className="zone zone-concourse" x="-0.55" y="-.15" width="11.1" height="6.45" rx=".28" />
            <text className="zone-label" x="8.85" y="5.85">4호선 대합실 · 단순화</text>
            <rect className="zone zone-transfer" x=".1" y="3.7" width="4.05" height="2.35" rx=".28" />
            <text className="zone-label" x=".35" y="4.15">1·4호선 환승 구간 · 단순화</text>
            <rect className="zone zone-platform" x="2.65" y="6.75" width="3.95" height="2.05" rx=".28" />
            <text className="zone-label" x="2.9" y="8.55">4호선 승강장 · 단순화</text>
            <rect className="stair-zone" x="3.05" y="4.65" width="3.05" height="3.2" rx=".2" />
          </g>
        )}

        <g aria-label="간선">
          {visibleEdges.map((edge) => {
            const geometry = getEdgeGeometry(mapData, edge)
            const blocked = blockedEdges.has(edge.id)
            const congested = edge.id in congestionDelays
            const hazard = hazardEdges.has(edge.id)
            const classes = ['map-edge', edge.type === 'STAIR' && 'is-stair', blocked && 'is-blocked', congested && 'is-congested', hazard && 'is-hazard']
              .filter(Boolean).join(' ')
            return (
              <g key={edge.id} data-testid={`edge-${edge.id}`} data-edge-id={edge.id}>
                <path
                  d={geometry.path}
                  className={classes}
                  markerEnd={edge.bidirectional ? undefined : 'url(#arrow)'}
                >
                  <title>{`${edge.id}: ${edge.source} → ${edge.target}, ${edge.length_m}m, ${edge.bidirectional ? '양방향' : '일방향'}`}</title>
                </path>
              </g>
            )
          })}
        </g>

        <g aria-label="경로 강조">
          {visibleEdges.filter((edge) => baselineEdges.has(edge.id)).map((edge) => (
            <path key={`baseline-${edge.id}`} d={getEdgeGeometry(mapData, edge).path}
              className="route-overlay route-baseline" data-testid={`baseline-${edge.id}`} />
          ))}
          {visibleEdges.filter((edge) => scenarioEdges.has(edge.id)).map((edge) => (
            <path key={`scenario-${edge.id}`} d={getEdgeGeometry(mapData, edge).path}
              className="route-overlay route-scenario" data-testid={`scenario-${edge.id}`} />
          ))}
        </g>

        <g aria-label="통로 상태 표식">
          {visibleEdges.filter((edge) => blockedEdges.has(edge.id) || hazardEdges.has(edge.id) || edge.id in congestionDelays).map((edge) => {
            const geometry = getEdgeGeometry(mapData, edge)
            return (
              <g key={`status-${edge.id}`}>
                {edge.id in congestionDelays && (
                  <text x={geometry.midpoint.x} y={geometry.midpoint.y - 0.18} className="edge-status-label">
                    +{congestionDelays[edge.id]}s
                  </text>
                )}
                {blockedEdges.has(edge.id) && (
                  <g className="blocked-cross" aria-label={`${edge.id} 차단`}>
                    <circle cx={geometry.midpoint.x} cy={geometry.midpoint.y} r=".25" />
                    <path d={`M ${geometry.midpoint.x - 0.16} ${geometry.midpoint.y - 0.16} L ${geometry.midpoint.x + 0.16} ${geometry.midpoint.y + 0.16}`} />
                    <path d={`M ${geometry.midpoint.x + 0.16} ${geometry.midpoint.y - 0.16} L ${geometry.midpoint.x - 0.16} ${geometry.midpoint.y + 0.16}`} />
                  </g>
                )}
                {hazardEdges.has(edge.id) && (
                  <g className="fire-marker" aria-label={`${edge.id} 화재 가정 위치`}>
                    <circle cx={geometry.midpoint.x} cy={geometry.midpoint.y} r=".27" />
                    <text x={geometry.midpoint.x} y={geometry.midpoint.y + 0.08}>!</text>
                    <text x={geometry.midpoint.x} y={geometry.midpoint.y + 0.55} className="fire-label">화재 가정</text>
                  </g>
                )}
              </g>
            )
          })}
        </g>

        <g aria-label="노드">
          {visibleNodes.map((node) => {
            const closed = blockedExits.has(node.id)
            const selected = selectedStartNodeId === node.id
            const selectedExit = node.id === (scenarioRoute?.selected_exit_id || baselineRoute?.selected_exit_id)
            const label = displayLabels.get(node.id) || node.label
            const layout = labelLayouts.get(node.id)
            return (
              <g key={node.id} data-testid={`node-${node.id}`} className={`map-node node-${node.type.toLowerCase()}${selected ? ' is-selected' : ''}${selectedExit ? ' is-route-exit' : ''}${closed ? ' is-closed' : ''}`}>
                <circle cx={node.x} cy={node.y} r={selected || selectedExit ? 0.34 : 0.27}
                  style={selectedExit ? { fill: '#08a47c', stroke: '#ffffff', strokeWidth: 0.14 } : undefined}>
                  <title>{`${node.id}: ${node.label}, ${node.floor}층, ${node.type}`}</title>
                </circle>
                {closed && <path className="closed-cross" d={`M ${node.x - 0.25} ${node.y - 0.25} L ${node.x + 0.25} ${node.y + 0.25} M ${node.x + 0.25} ${node.y - 0.25} L ${node.x - 0.25} ${node.y + 0.25}`} />}
                {layout && (
                  <g className="node-label-group" data-label-id={node.id}>
                    {layout.leader && (
                      <line className="label-leader" x1={node.x} y1={node.y} x2={layout.x} y2={layout.y - layout.height / 2} />
                    )}
                    <rect
                      x={layout.anchor === 'middle' ? layout.x - layout.width / 2 : layout.anchor === 'start' ? layout.x : layout.x - layout.width}
                      y={layout.y - layout.height + 0.08}
                      width={layout.width}
                      height={layout.height}
                      rx=".1"
                    />
                    <text x={layout.x} y={layout.y - (layout.lines.length - 1) * 0.31} textAnchor={layout.anchor} className="node-label">
                      {layout.lines.map((line, index) => (
                        <tspan key={`${node.id}-${index}`} x={layout.x} dy={index === 0 ? 0 : 0.31}>{line}</tspan>
                      ))}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
        </svg>
      </div>
    </section>
  )
}
