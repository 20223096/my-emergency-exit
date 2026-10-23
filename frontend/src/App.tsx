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
  if (!route.reachable) return '사용 가능한 경로가 없습니다.'
  return `${route.selected_exit_id} · ${route.distance_m}m · ${route.total_time_s}초`
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

  const starts = useMemo(() => mapData?.nodes.filter((node) => node.type === 'START') || [], [mapData])
  const floors = useMemo(() => [...new Set(mapData?.nodes.map((node) => node.floor) || [])].sort(), [mapData])

  useEffect(() => {
    if (starts.length && !starts.some((node) => node.id === startNodeId)) setStartNodeId(starts[0].id)
  }, [starts, startNodeId])

  const selectScenario = (id: string) => {
    setScenarioId(id)
    const selected = scenarios.find((scenario) => scenario.id === id)
    if (!selected) {
      setConditions(emptyConditions())
      return
    }
    if (selected.map_id !== selectedMapId) setSelectedMapId(selected.map_id)
    setStartNodeId(selected.start_node_id)
    setConditions(selected.conditions)
  }

  const requestBody = (): RouteRequest => ({
    map_id: selectedMapId,
    start_node_id: startNodeId,
    blocked_edge_ids: conditions.blocked_edge_ids,
    blocked_exit_ids: conditions.blocked_exit_ids,
    congestion_delays: conditions.congestion_delays,
    walking_speed_mps: 1.2,
    reaction_delay_s: 5,
  })

  const runAction = async (kind: 'calculate' | 'compare') => {
    if (!selectedMapId || !startNodeId) return
    setActionLoading(true)
    setActionError(null)
    try {
      if (kind === 'calculate') {
        setRoute(await calculateRoute(requestBody()))
      } else {
        const result = await compareRoutes(requestBody())
        setComparison(result)
        setRoute(result.scenario)
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
        <p className="eyebrow">NAVIEXIT · DEVELOPMENT CONSOLE</p>
        <h1>내비상구 경로 실험 화면</h1>
        <p>가상 공간과 가정값으로 API 및 SVG 시각화를 검증하는 개발용 화면입니다.</p>
      </header>

      <section className="controls" aria-label="경로 조건">
        <label>지도
          <select aria-label="지도 선택" value={selectedMapId} onChange={(event) => setSelectedMapId(event.target.value)}>
            {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
          </select>
        </label>
        <label>시작 위치
          <select aria-label="시작 위치 선택" value={startNodeId} onChange={(event) => setStartNodeId(event.target.value)}>
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
        <div className="button-row">
          <button disabled={actionLoading || dataLoading || !mapData} onClick={() => void runAction('calculate')}>경로 계산</button>
          <button className="secondary" disabled={actionLoading || dataLoading || !mapData} onClick={() => void runAction('compare')}>기본 경로와 비교</button>
        </div>
      </section>

      {(dataLoading || actionLoading) && <p className="status" role="status">데이터를 처리하고 있습니다…</p>}
      {displayError && <div className="error" role="alert"><strong>{displayError.kind}</strong> · {displayError.message}</div>}

      {mapData && (
        <MapCanvas
          mapData={mapData}
          baselineRoute={comparison?.baseline}
          scenarioRoute={comparison?.scenario || route}
          blockedEdgeIds={conditions.blocked_edge_ids}
          blockedExitIds={conditions.blocked_exit_ids}
          congestionDelays={conditions.congestion_delays}
          selectedStartNodeId={startNodeId}
          floor={floor}
        />
      )}

      <section className="results" aria-label="계산 결과">
        <article><span>계산 경로</span><strong>{resultText(route)}</strong></article>
        <article><span>기본 경로</span><strong>{resultText(comparison?.baseline || null)}</strong></article>
        <article><span>변경 경로</span><strong>{resultText(comparison?.scenario || null)}</strong></article>
        {comparison?.change_reasons.map((reason) => <p key={reason} className="reason">{reason}</p>)}
      </section>

      <footer>실제 재난 안내가 아닌 실험용 프로토타입입니다. 좌표는 상대 위치이며 거리·시간은 백엔드 계산값입니다.</footer>
    </main>
  )
}
