import type { IndoorMap, RouteResult } from '../types/api'
import { getEdgeGeometry, getViewBox } from '../utils/mapGeometry'

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

  return (
    <section className="map-panel" aria-label="실험용 공간 지도">
      <div className="legend" aria-label="지도 범례">
        <span className="legend-baseline">기본 경로</span>
        <span className="legend-scenario">변경 경로</span>
        <span className="legend-blocked">차단</span>
        <span className="legend-congested">혼잡</span>
        <span className="legend-stair">계단/층 연결</span>
        <span className="legend-fire">화재 가정 위치</span>
      </div>
      <svg
        className="map-canvas"
        viewBox={getViewBox(visibleNodes)}
        role="img"
        aria-label={`${mapData.metadata.name}${floor === null ? ' 전체 층' : ` ${floor}층`}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="direction-arrow" />
          </marker>
        </defs>

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
                {congested && (
                  <text x={geometry.midpoint.x} y={geometry.midpoint.y - 0.18} className="edge-status-label">
                    +{congestionDelays[edge.id]}s
                  </text>
                )}
                {blocked && (
                  <g className="blocked-cross" aria-label={`${edge.id} 차단`}>
                    <path d={`M ${geometry.midpoint.x - 0.18} ${geometry.midpoint.y - 0.18} L ${geometry.midpoint.x + 0.18} ${geometry.midpoint.y + 0.18}`} />
                    <path d={`M ${geometry.midpoint.x + 0.18} ${geometry.midpoint.y - 0.18} L ${geometry.midpoint.x - 0.18} ${geometry.midpoint.y + 0.18}`} />
                  </g>
                )}
                {hazard && <text x={geometry.midpoint.x} y={geometry.midpoint.y + 0.35} className="fire-label">🔥 화재 가정</text>}
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

        <g aria-label="노드">
          {visibleNodes.map((node) => {
            const closed = blockedExits.has(node.id)
            const selected = selectedStartNodeId === node.id
            return (
              <g key={node.id} data-testid={`node-${node.id}`} className={`map-node node-${node.type.toLowerCase()}${selected ? ' is-selected' : ''}${closed ? ' is-closed' : ''}`}>
                <circle cx={node.x} cy={node.y} r={selected ? 0.34 : 0.27}>
                  <title>{`${node.id}: ${node.label}, ${node.floor}층, ${node.type}`}</title>
                </circle>
                {closed && <path className="closed-cross" d={`M ${node.x - 0.25} ${node.y - 0.25} L ${node.x + 0.25} ${node.y + 0.25} M ${node.x + 0.25} ${node.y - 0.25} L ${node.x - 0.25} ${node.y + 0.25}`} />}
                <text x={node.x} y={node.y - 0.43} className="node-label">{node.id} · {node.floor}F</text>
              </g>
            )
          })}
        </g>
      </svg>
    </section>
  )
}
