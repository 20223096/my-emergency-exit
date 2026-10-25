import { useEffect, useMemo, useState } from 'react'
import { ApiError } from './api/client'
import { calculateRoute, compareRoutes } from './api/routes'
import { MapCanvas } from './components/MapCanvas'
import { useMapData } from './hooks/useMapData'
import type { RouteComparison, RouteRequest, RouteResult, ScenarioConditions } from './types/api'
import './styles.css'

const emptyConditions = (): ScenarioConditions => ({
  blocked_edge_ids: [],
  blocked_exit_ids: [],
  congestion_delays: {},
})

function resultText(route: RouteResult | null): string {
  if (!route) return '아직 계산하지 않았습니다.'
  if (!route.reachable) return '이동 가능한 경로 없음'
  return `${displayExit(route.selected_exit_id)} · ${route.distance_m}m · ${route.total_time_s}초`
}

function displayExit(exitId: string | null): string {
  const match = exitId?.match(/^EXIT_(\d+)$/)
  return match ? `${match[1]}번 출구` : exitId || '—'
}

function RouteCard({ title, route, tone }: { title: string; route: RouteResult | null; tone: 'baseline' | 'scenario' }) {
  const status = !route ? '대기' : route.reachable ? '이동 가능' : '경로 없음'
  return (
    <article className={`route-card ${tone}${route && !route.reachable ? ' unreachable' : ''}`}>
      <div className="card-heading"><span>{title}</span><em>{status}</em></div>
      {!route || !route.reachable ? (
        <strong className="route-summary">{resultText(route)}</strong>
      ) : (
        <>
          <strong className="route-exit">{displayExit(route.selected_exit_id)}</strong>
          <dl>
            <div><dt>거리</dt><dd>{route.distance_m}m</dd></div>
            <div><dt>모의 총시간</dt><dd>{route.total_time_s}초</dd></div>
          </dl>
        </>
      )}
    </article>
  )
}

export default function App() {
  const { maps, scenarios, mapData, selectedMapId, setSelectedMapId, loading: dataLoading, error: dataError } = useMapData()
  const [startNodeId, setStartNodeId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [conditions, setConditions] = useState<ScenarioConditions>(emptyConditions)
  const [floor, setFloor] = useState<number | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [comparison, setComparison] = useState<RouteComparison | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<ApiError | null>(null)
  const [walkingSpeed, setWalkingSpeed] = useState(1.2)
  const [stairSpeed, setStairSpeed] = useState(0.8)
  const [reactionDelay, setReactionDelay] = useState(5)
  const [congestionEdgeId, setCongestionEdgeId] = useState('')
  const [congestionDelay, setCongestionDelay] = useState(30)

  const starts = useMemo(() => mapData?.nodes.filter((node) => node.type === 'START') || [], [mapData])
  const floors = useMemo(() => [...new Set(mapData?.nodes.map((node) => node.floor) || [])].sort(), [mapData])
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId)

  useEffect(() => {
    if (starts.length && !starts.some((node) => node.id === startNodeId)) setStartNodeId(starts[0].id)
  }, [starts, startNodeId])

  const selectScenario = (id: string) => {
    setScenarioId(id)
    setRoute(null)
    setComparison(null)
    const selected = scenarios.find((scenario) => scenario.id === id)
    if (!selected) {
      setConditions(emptyConditions())
      return
    }
    if (selected.map_id !== selectedMapId) {
      setSelectedMapId(selected.map_id)
      setStartNodeId(selected.start_node_id)
    }
    if (selected.id === 'seoul-fire-b-unreachable') setStartNodeId(selected.start_node_id)
    setConditions(selected.conditions)
  }

  const changeStart = (startId: string) => {
    setStartNodeId(startId)
    setRoute(null)
    setComparison(null)
    setActionError(null)
  }

  const requestBody = (): RouteRequest => ({
    map_id: selectedMapId,
    start_node_id: startNodeId,
    blocked_edge_ids: conditions.blocked_edge_ids,
    blocked_exit_ids: conditions.blocked_exit_ids,
    congestion_delays: conditions.congestion_delays,
    walking_speed_mps: walkingSpeed,
    stair_speed_mps: stairSpeed,
    reaction_delay_s: reactionDelay,
  })

  const addCongestion = () => {
    if (!congestionEdgeId) return
    setConditions((current) => ({
      ...current,
      congestion_delays: { ...current.congestion_delays, [congestionEdgeId]: congestionDelay },
    }))
    setRoute(null)
    setComparison(null)
  }

  const reset = () => {
    setScenarioId('')
    setConditions(emptyConditions())
    setWalkingSpeed(1.2)
    setStairSpeed(0.8)
    setReactionDelay(5)
    setCongestionEdgeId('')
    setCongestionDelay(30)
    setRoute(null)
    setComparison(null)
    setActionError(null)
  }

  const changeMap = (mapId: string) => {
    setSelectedMapId(mapId)
    setScenarioId('')
    setConditions(emptyConditions())
    setCongestionEdgeId('')
    setRoute(null)
    setComparison(null)
    setActionError(null)
  }

  const runAction = async (kind: 'calculate' | 'compare') => {
    if (!selectedMapId || !startNodeId) return
    setActionLoading(true)
    setActionError(null)
    try {
      if (kind === 'calculate') {
        const result = await calculateRoute(requestBody())
        setComparison(null)
        setRoute(result)
      } else {
        const result = await compareRoutes(requestBody())
        setComparison(result)
        setRoute(null)
      }
    } catch (reason) {
      setActionError(reason instanceof ApiError ? reason : new ApiError('경로 요청에 실패했습니다.', 'server', null, reason))
    } finally {
      setActionLoading(false)
    }
  }

  const displayError = actionError || dataError

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">NAVIEXIT · SEOUL STATION PROTOTYPE</p>
        <h1>내비상구 · 경로 비교 시연</h1>
        <p>서울역 단순화 그래프에서 기본 조건과 화재·혼잡 가정 이후의 경로를 비교하는 10월 31일 제출용 프로토타입입니다.</p>
      </header>

      <section className="controls" aria-label="경로 조건">
        <label>지도
          <select aria-label="지도 선택" value={selectedMapId} onChange={(event) => changeMap(event.target.value)}>
            {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
          </select>
        </label>
        <label>시작 위치
          <select aria-label="시작 위치 선택" value={startNodeId} onChange={(event) => changeStart(event.target.value)}>
            {starts.map((node) => <option key={node.id} value={node.id}>{node.id} · {node.label}</option>)}
          </select>
        </label>
        <label>사전 시나리오
          <select aria-label="시나리오 선택" value={scenarioId} onChange={(event) => selectScenario(event.target.value)}>
            <option value="">기본 조건</option>
            {scenarios.filter((scenario) => scenario.map_id === selectedMapId).map((scenario) => (
              <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
            ))}
          </select>
        </label>
        <label>표시 층
          <select aria-label="층 선택" value={floor ?? 'all'} onChange={(event) => setFloor(event.target.value === 'all' ? null : Number(event.target.value))}>
            <option value="all">전체 층</option>
            {floors.map((item) => <option key={item} value={item}>{item}층</option>)}
          </select>
        </label>
        <label>평지 속도 (m/s)
          <input aria-label="평지 이동속도" type="number" min="0.1" max="10" step="0.1" value={walkingSpeed} onChange={(event) => setWalkingSpeed(Number(event.target.value))} />
        </label>
        <label>계단 속도 (m/s)
          <input aria-label="계단 이동속도" type="number" min="0.1" max="10" step="0.1" value={stairSpeed} onChange={(event) => setStairSpeed(Number(event.target.value))} />
        </label>
        <label>출발 반응시간 (초)
          <input aria-label="출발 반응시간" type="number" min="0" max="3600" value={reactionDelay} onChange={(event) => setReactionDelay(Number(event.target.value))} />
        </label>
        <label>혼잡 구간
          <select aria-label="혼잡 구간 선택" value={congestionEdgeId} onChange={(event) => setCongestionEdgeId(event.target.value)}>
            <option value="">구간 선택</option>
            {mapData?.edges.map((edge) => <option key={edge.id} value={edge.id}>{edge.id} · {edge.source}–{edge.target}</option>)}
          </select>
        </label>
        <label>혼잡 추가 지연 (초)
          <input aria-label="혼잡 추가 지연" type="number" min="0" value={congestionDelay} onChange={(event) => setCongestionDelay(Number(event.target.value))} />
        </label>
        <div className="inline-action"><button className="secondary" disabled={!congestionEdgeId} onClick={addCongestion}>혼잡 지연 추가</button></div>
        <div className="button-row">
          <button disabled={actionLoading || dataLoading || !mapData} onClick={() => void runAction('calculate')}>경로 계산</button>
          <button className="secondary" disabled={actionLoading || dataLoading || !mapData} onClick={() => void runAction('compare')}>기본 경로와 비교</button>
          <button className="reset" disabled={actionLoading} onClick={reset}>초기화</button>
        </div>
      </section>

      {(dataLoading || actionLoading) && <p className="status" role="status">데이터를 처리하고 있습니다…</p>}
      {displayError && <div className="error" role="alert"><strong>{displayError.kind}</strong> · {displayError.message}</div>}

      {mapData && (
        <MapCanvas
          mapData={mapData}
          baselineRoute={comparison?.baseline}
          scenarioRoute={comparison?.scenario || (!comparison ? route : null)}
          blockedEdgeIds={conditions.blocked_edge_ids}
          blockedExitIds={conditions.blocked_exit_ids}
          congestionDelays={conditions.congestion_delays}
          selectedStartNodeId={startNodeId}
          floor={floor}
          hazardEdgeIds={selectedScenario?.hazard_edge_ids || []}
        />
      )}

      {mapData?.metadata.safety_notice && <p className="notice">{mapData.metadata.safety_notice}</p>}
      {selectedScenario && <p className="scenario-description"><strong>{selectedScenario.name}</strong> · {selectedScenario.description}</p>}
      {selectedScenario?.assumption_notice && <p className="notice scenario-notice">{selectedScenario.assumption_notice}</p>}

      <section className="results" aria-label="계산 결과">
        <div className="results-heading">
          <div><span>{comparison ? 'ROUTE COMPARISON' : 'CURRENT CONDITION'}</span><h2>{comparison ? '경로 비교 결과' : '현재 조건 계산 결과'}</h2></div>
          <strong>{selectedScenario?.name || (Object.keys(conditions.congestion_delays).length ? '혼잡 조건 비교' : '기본 조건')}</strong>
        </div>
        {comparison ? (
          <>
            <div className="route-cards">
              <RouteCard title="차단 전 기본 경로" route={comparison.baseline} tone="baseline" />
              <div className="comparison-arrow" aria-hidden="true">→</div>
              <RouteCard title="차단 후 변경 경로" route={comparison.scenario} tone="scenario" />
            </div>
            <div className="delta-cards">
              <article><span>출구</span><strong>{comparison.exit_changed ? '변경됨' : '동일'}</strong></article>
              <article><span>우회 거리</span><strong>{comparison.distance_delta_m == null ? '—' : `${comparison.distance_delta_m >= 0 ? '+' : ''}${comparison.distance_delta_m}m`}</strong></article>
              <article><span>시간 변화</span><strong>{comparison.total_time_delta_s == null ? '—' : `${comparison.total_time_delta_s >= 0 ? '+' : ''}${comparison.total_time_delta_s}초`}</strong></article>
            </div>
            {comparison.change_reasons.map((reason) => <p key={reason} className="reason">{reason}</p>)}
          </>
        ) : (
          <div className="standalone-result">
            <RouteCard title="현재 조건 계산 결과" route={route} tone="scenario" />
            <p>현재 선택한 지도·출발점·재난·혼잡 조건을 그대로 적용한 단일 계산 결과입니다.</p>
          </div>
        )}
      </section>

      <footer>실제 재난 안내가 아닌 실험용 프로토타입입니다. 좌표는 상대 위치이며 거리·시간은 백엔드 계산값입니다.</footer>
    </main>
  )
}
