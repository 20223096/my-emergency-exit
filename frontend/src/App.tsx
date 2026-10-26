import { useEffect, useMemo, useState } from 'react'
import { ApiError } from './api/client'
import { calculateRoute, compareRoutes } from './api/routes'
import { MapCanvas } from './components/MapCanvas'
import { useMapData } from './hooks/useMapData'
import type { IndoorMap, RouteComparison, RouteRequest, RouteResult, ScenarioConditions } from './types/api'
import './styles.css'

const emptyConditions = (): ScenarioConditions => ({ blocked_edge_ids: [], blocked_exit_ids: [], congestion_delays: {} })

function displayExit(exitId: string | null): string {
  const match = exitId?.match(/^EXIT_(\d+)$/)
  return match ? `${match[1]}번 출구` : exitId || '—'
}

function metric(value: number | null, unit: string) {
  return value == null ? '—' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}${unit}`
}

function RouteCard({ title, route, tone }: { title: string; route: RouteResult | null; tone: 'baseline' | 'scenario' }) {
  const status = !route ? '계산 전' : route.reachable ? '도달 가능' : '경로 없음'
  return (
    <article className={`route-card ${tone}${route && !route.reachable ? ' unreachable' : ''}`}>
      <div className="card-heading"><span>{title}</span><em>{status}</em></div>
      {!route ? <strong className="route-summary">아직 계산하지 않았습니다.</strong> : !route.reachable ? (
        <strong className="route-summary">이동 가능한 경로 없음</strong>
      ) : (
        <><strong className="route-exit">{displayExit(route.selected_exit_id)}</strong><dl><div><dt>이동거리</dt><dd>{metric(route.distance_m, ' m')}</dd></div><div><dt>모의 이동시간</dt><dd>{metric(route.total_time_s, ' 초')}</dd></div></dl></>
      )}
    </article>
  )
}

function RouteSegments({ mapData, route, conditions }: { mapData: IndoorMap; route: RouteResult | null; conditions: ScenarioConditions }) {
  const nodes = new Map(mapData.nodes.map((node) => [node.id, node]))
  const edges = new Map(mapData.edges.map((edge) => [edge.id, edge]))
  if (!route) return <p className="segments-empty">계산 후 실제 경로 구간이 표시됩니다.</p>
  if (!route.reachable) return <p className="segments-empty danger">표시할 이동 구간이 없습니다.</p>
  return <ol className="segment-list">{route.path_edges.map((edgeId, index) => {
    const edge = edges.get(edgeId)
    if (!edge) return null
    const from = nodes.get(route.path_nodes[index]); const to = nodes.get(route.path_nodes[index + 1]); const delay = conditions.congestion_delays[edgeId]
    return <li key={`${edgeId}-${index}`}><span className={`segment-icon ${edge.type.toLowerCase()}`} aria-hidden="true" /><div><strong>{from?.label || edge.source} → {to?.label || edge.target}</strong><small>{edge.id}{edge.type === 'STAIR' ? ' · 계단/층 연결' : ' · 통로'}</small></div><span className="segment-value">{edge.length_m} m{delay != null && <small>+{delay}초</small>}</span></li>
  })}</ol>
}

export default function App() {
  const { maps, scenarios, mapData, selectedMapId, setSelectedMapId, loading: dataLoading, error: dataError } = useMapData()
  const [startNodeId, setStartNodeId] = useState(''); const [scenarioId, setScenarioId] = useState('')
  const [conditions, setConditions] = useState<ScenarioConditions>(emptyConditions); const [floor, setFloor] = useState<number | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null); const [comparison, setComparison] = useState<RouteComparison | null>(null)
  const [actionLoading, setActionLoading] = useState(false); const [actionError, setActionError] = useState<ApiError | null>(null)
  const [walkingSpeed, setWalkingSpeed] = useState(1.2); const [stairSpeed, setStairSpeed] = useState(0.8); const [reactionDelay, setReactionDelay] = useState(5)
  const [congestionEdgeId, setCongestionEdgeId] = useState(''); const [congestionDelay, setCongestionDelay] = useState(30)

  const starts = useMemo(() => mapData?.nodes.filter((node) => node.type === 'START') || [], [mapData])
  const floors = useMemo(() => [...new Set(mapData?.nodes.map((node) => node.floor) || [])].sort(), [mapData])
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId); const activeRoute = comparison?.scenario || route
  useEffect(() => { if (starts.length && !starts.some((node) => node.id === startNodeId)) setStartNodeId(starts[0].id) }, [starts, startNodeId])
  const invalidate = () => { setRoute(null); setComparison(null); setActionError(null) }
  const selectScenario = (id: string) => {
    setScenarioId(id); invalidate(); const selected = scenarios.find((scenario) => scenario.id === id)
    if (!selected) { setConditions(emptyConditions()); return }
    if (selected.map_id !== selectedMapId) setSelectedMapId(selected.map_id)
    setStartNodeId(selected.start_node_id); setConditions(selected.conditions)
  }
  const updateNumber = (setter: (value: number) => void, value: number) => { setter(value); invalidate() }
  const requestBody = (): RouteRequest => ({ map_id: selectedMapId, start_node_id: startNodeId, blocked_edge_ids: conditions.blocked_edge_ids, blocked_exit_ids: conditions.blocked_exit_ids, congestion_delays: conditions.congestion_delays, walking_speed_mps: walkingSpeed, stair_speed_mps: stairSpeed, reaction_delay_s: reactionDelay })
  const addCongestion = () => { if (!congestionEdgeId) return; setConditions((current) => ({ ...current, congestion_delays: { ...current.congestion_delays, [congestionEdgeId]: congestionDelay } })); invalidate() }
  const reset = () => { setScenarioId(''); setConditions(emptyConditions()); setWalkingSpeed(1.2); setStairSpeed(0.8); setReactionDelay(5); setCongestionEdgeId(''); setCongestionDelay(30); setFloor(null); invalidate() }
  const changeMap = (mapId: string) => { setSelectedMapId(mapId); setScenarioId(''); setConditions(emptyConditions()); setCongestionEdgeId(''); setFloor(null); invalidate() }
  const runAction = async (kind: 'calculate' | 'compare') => {
    if (!selectedMapId || !startNodeId) return; setActionLoading(true); setActionError(null)
    try { if (kind === 'calculate') { setRoute(await calculateRoute(requestBody())); setComparison(null) } else { setComparison(await compareRoutes(requestBody())); setRoute(null) } }
    catch (reason) { setActionError(reason instanceof ApiError ? reason : new ApiError('경로 요청에 실패했습니다.', 'server', null, reason)) }
    finally { setActionLoading(false) }
  }
  const displayError = actionError || dataError; const conditionCount = conditions.blocked_edge_ids.length + conditions.blocked_exit_ids.length + Object.keys(conditions.congestion_delays).length

  return <main className="app-shell">
    <header className="app-header"><div><p className="eyebrow">SEOUL STATION · EVACUATION SIMULATION</p><h1>내비상구 · 경로 비교 시연</h1><p>화재·차단·혼잡 조건에 따른 서울역 대피경로 비교</p></div><div className="mode-status" aria-label="표시 경로 상태"><span className="is-on">✓ 기본 경로</span><span className={conditionCount ? 'is-on' : ''}>✓ 조건 반영</span></div></header>
    {(dataLoading || actionLoading) && <p className="status" role="status">데이터를 처리하고 있습니다…</p>}{displayError && <div className="error" role="alert"><strong>{displayError.kind}</strong> · {displayError.message}</div>}
    <div className="workspace">
      <section className="map-column" aria-label="지도 및 경로"><div className="section-title"><div><span>ROUTE MAP</span><h2>{mapData?.metadata.name || '지도 불러오는 중'}</h2></div><label className="compact-label">표시 층<select aria-label="층 선택" value={floor ?? 'all'} onChange={(event) => { setFloor(event.target.value === 'all' ? null : Number(event.target.value)); invalidate() }}><option value="all">전체 층</option>{floors.map((item) => <option key={item} value={item}>{item}층</option>)}</select></label></div>
        {mapData && <MapCanvas mapData={mapData} baselineRoute={comparison?.baseline} scenarioRoute={activeRoute} blockedEdgeIds={conditions.blocked_edge_ids} blockedExitIds={conditions.blocked_exit_ids} congestionDelays={conditions.congestion_delays} selectedStartNodeId={startNodeId} floor={floor} hazardEdgeIds={selectedScenario?.hazard_edge_ids || []} />}
        <p className="map-caption">실제 역사 안내도가 아닌 검증된 실험 그래프 기반 상대 좌표입니다. 경로와 수치는 백엔드 계산 결과를 사용합니다.</p></section>
      <aside className="side-column">
        <section className="panel condition-panel" aria-label="경로 조건"><div className="panel-heading"><div><span>조건 설정</span><h2>{selectedScenario?.name || '기본 조건'}</h2></div><button className="text-button" onClick={reset} disabled={actionLoading}>초기화</button></div>
          <div className="control-grid"><label>지도<select aria-label="지도 선택" value={selectedMapId} onChange={(event) => changeMap(event.target.value)}>{maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label><label>출발점<select aria-label="시작 위치 선택" value={startNodeId} onChange={(event) => { setStartNodeId(event.target.value); invalidate() }}>{starts.map((node) => <option key={node.id} value={node.id}>{node.id} · {node.label}</option>)}</select></label><label className="wide">화재·차단 시나리오<select aria-label="시나리오 선택" value={scenarioId} onChange={(event) => selectScenario(event.target.value)}><option value="">기본 조건</option>{scenarios.filter((scenario) => scenario.map_id === selectedMapId).map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label><label>평지 이동속도 <span>m/s</span><input aria-label="평지 이동속도" type="number" min="0.1" max="10" step="0.1" value={walkingSpeed} onChange={(event) => updateNumber(setWalkingSpeed, Number(event.target.value))} /></label><label>계단 이동속도 <span>m/s</span><input aria-label="계단 이동속도" type="number" min="0.1" max="10" step="0.1" value={stairSpeed} onChange={(event) => updateNumber(setStairSpeed, Number(event.target.value))} /></label><label className="wide">출발 반응시간 <span>초</span><input aria-label="출발 반응시간" type="number" min="0" max="3600" value={reactionDelay} onChange={(event) => updateNumber(setReactionDelay, Number(event.target.value))} /></label></div>
          <div className="congestion-controls"><label>혼잡 구간<select aria-label="혼잡 구간 선택" value={congestionEdgeId} onChange={(event) => { setCongestionEdgeId(event.target.value); invalidate() }}><option value="">구간 선택</option>{mapData?.edges.map((edge) => <option key={edge.id} value={edge.id}>{edge.id} · {edge.source}–{edge.target}</option>)}</select></label><label>지연시간 (초)<input aria-label="혼잡 추가 지연" type="number" min="0" value={congestionDelay} onChange={(event) => { setCongestionDelay(Number(event.target.value)); invalidate() }} /></label><button className="secondary compact" disabled={!congestionEdgeId} onClick={addCongestion}>혼잡 지연 추가</button></div>
          {selectedScenario && <p className="condition-note">{selectedScenario.description}</p>}<div className="button-row"><button disabled={actionLoading || dataLoading || !mapData} onClick={() => void runAction('calculate')}>경로 계산</button><button className="secondary" disabled={actionLoading || dataLoading || !mapData} onClick={() => void runAction('compare')}>기본 경로와 비교</button></div></section>
        <section className="panel results" aria-label="계산 결과"><div className="panel-heading"><div><span>결과 비교</span><h2>{comparison ? '기본·변경 경로' : '현재 조건 계산 결과'}</h2></div></div>{comparison ? <><div className="route-cards"><RouteCard title="차단 전 기본 경로" route={comparison.baseline} tone="baseline" /><RouteCard title="차단 후 변경 경로" route={comparison.scenario} tone="scenario" /></div><div className="delta-strip"><span>우회 거리 <strong>{metric(comparison.distance_delta_m, ' m')}</strong></span><span>시간 변화 <strong>{metric(comparison.total_time_delta_s, ' 초')}</strong></span></div>{comparison.change_reasons.map((reason) => <p key={reason} className="reason">{reason}</p>)}</> : <RouteCard title="현재 조건 계산 결과" route={route} tone="scenario" />}</section>
        <section className="panel segments" aria-label="경로 구간"><div className="panel-heading"><div><span>경로 구간</span><h2>실제 계산 간선</h2></div></div>{mapData && <RouteSegments mapData={mapData} route={activeRoute} conditions={conditions} />}</section>
      </aside>
    </div>
    {(mapData?.metadata.safety_notice || selectedScenario?.assumption_notice) && <div className="notice"><strong>실험 안내</strong><span>{selectedScenario?.assumption_notice || mapData?.metadata.safety_notice}</span></div>}<footer>본 화면은 발표용 실험 프로토타입이며 실제 재난 안내 또는 공식 대피경로가 아닙니다.</footer>
  </main>
}
