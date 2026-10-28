import { useMemo, useState } from 'react'
import { ApiError } from '../api/client'
import { compareMultiAgent } from '../api/routes'
import type { IndoorMap, MultiAgentComparisonResult, MultiAgentSimulationRequest, MultiAgentSimulationResult, Scenario } from '../types/api'
import { MapCanvas } from './MapCanvas'

const scenarioOptions = [
  { id: 'baseline', label: '차단 없음' },
  { id: 'seoul-fire-a-approach', label: '화재 A · 11번 접근 차단' },
  { id: 'seoul-fire-b-stair', label: '화재 B · 계단 A 차단' },
  { id: 'seoul-fire-b-unreachable', label: '계단 A+B 차단' },
]

function ResultCard({ title, result }: { title: string; result: MultiAgentSimulationResult }) {
  const exits = Object.entries(result.arrivals_by_exit).map(([id, count]) => `${id.replace('EXIT_', '')}번 ${count}명`).join(' · ')
  return <article className="multi-result-card"><h3>{title}</h3><dl>
    <div><dt>도착 / 시작</dt><dd>{result.arrived_people} / {result.total_initial_people}명</dd></div>
    <div><dt>미도달</dt><dd>{result.not_arrived_people}명</dd></div>
    <div><dt>모의 종료 시각</dt><dd>{result.simulation_end_time_s}초</dd></div>
    <div><dt>마지막 도착</dt><dd>{result.last_arrival_time_s == null ? '—' : `${result.last_arrival_time_s}초`}</dd></div>
    <div><dt>평균 도착</dt><dd>{result.average_arrival_time_s == null ? '—' : `${result.average_arrival_time_s}초`}</dd></div>
  </dl><p>{exits || '도착 출구 없음'}</p><small>{result.end_reason}</small></article>
}

function QueueChart({ result }: { result: MultiAgentSimulationResult }) {
  const width = 620; const height = 170; const maxTime = Math.max(1, result.simulation_end_time_s)
  const observedMax = Math.max(0, ...result.timeline.map((point) => point.total_waiting)); const scaleMax = Math.max(1, observedMax)
  const points = result.timeline.map((point) => `${(point.time_s / maxTime) * width},${height - (point.total_waiting / scaleMax) * (height - 20)}`).join(' ')
  return <div className="queue-chart"><div><strong>시간별 모의 대기 인원</strong><span>최대 {observedMax}명</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="시간별 모의 대기열 그래프"><path d={`M0 ${height}H${width}`} /><polyline points={points || `0,${height}`} /></svg></div>
}

export function MultiAgentExperiment({ mapData, scenarios }: { mapData: IndoorMap | null; scenarios: Scenario[] }) {
  const [counts, setCounts] = useState({ S1: 20, S2: 20, S3: 20 }); const [delays, setDelays] = useState({ S1: 0, S2: 0, S3: 0 })
  const [scenarioId, setScenarioId] = useState('baseline'); const [walk, setWalk] = useState(1.2); const [stair, setStair] = useState(.8)
  const [corridorCapacity, setCorridorCapacity] = useState(2); const [stairCapacity, setStairCapacity] = useState(1); const [timeStep, setTimeStep] = useState(5); const [maxTime, setMaxTime] = useState(3600)
  const [overrideEdge, setOverrideEdge] = useState(''); const [overrideCapacity, setOverrideCapacity] = useState(1); const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [result, setResult] = useState<MultiAgentComparisonResult | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId)
  const conditions = selectedScenario?.conditions || { blocked_edge_ids: [], blocked_exit_ids: [], congestion_delays: {} }
  const total = counts.S1 + counts.S2 + counts.S3
  const valid = Boolean(mapData && total > 0 && Object.values(counts).every((value) => Number.isInteger(value) && value >= 0) && Object.values(delays).every((value) => Number.isFinite(value) && value >= 0) && [walk, stair, corridorCapacity, stairCapacity, maxTime].every((value) => Number.isFinite(value) && value > 0) && Number.isFinite(timeStep) && timeStep >= 1)
  const queueLevels = useMemo(() => {
    if (!mapData || !result) return undefined
    const metrics = new Map(result.scenario.edge_metrics.map((metric) => [metric.edge_id, metric])); const threshold = Math.max(10, Math.ceil(total * .2))
    return Object.fromEntries(mapData.edges.map((edge) => { const max = metrics.get(edge.id)?.max_queue_count || 0; return [edge.id, max >= threshold ? 'concentrated' : max > 0 ? 'waiting' : 'smooth'] })) as Record<string, 'smooth' | 'waiting' | 'concentrated'>
  }, [mapData, result, total])
  const run = async () => {
    if (!mapData || !valid || loading) return
    const request: MultiAgentSimulationRequest = { map_id: mapData.id, start_counts: counts, start_delays_s: delays, walking_speed_mps: walk, stair_speed_mps: stair, corridor_capacity_per_s: corridorCapacity, stair_capacity_per_s: stairCapacity, edge_capacity_overrides_per_s: overrides, time_step_s: timeStep, max_elapsed_s: maxTime, ...conditions }
    setLoading(true); setError(''); setResult(null)
    try { setResult(await compareMultiAgent(request)) } catch (reason) { setError(reason instanceof ApiError ? reason.message : '다중 인원 실험 요청에 실패했습니다.') } finally { setLoading(false) }
  }
  if (!mapData || mapData.id !== 'seoul-station-line4-prototype-v1') return <p className="status">서울역 실험 지도를 불러오는 중입니다.</p>
  return <section className="multi-agent-mode" aria-label="다중 인원 실험">
    <div className="multi-warning"><strong>가정 기반 다중 인원 실험</strong><span>실제 서울역 실시간 혼잡이나 검증된 군중 피난 예측이 아닙니다. 용량·속도·경로 선택은 실험 설정입니다.</span></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="multi-layout"><div className="multi-map"><MapCanvas mapData={mapData} blockedEdgeIds={conditions.blocked_edge_ids} blockedExitIds={conditions.blocked_exit_ids} hazardEdgeIds={selectedScenario?.hazard_edge_ids || []} simulatedQueueLevels={queueLevels} /><p>색상은 이번 입력의 모의 최대 대기 인원 등급이며 실제 혼잡 상태가 아닙니다.</p></div>
      <aside className="multi-controls panel"><div className="panel-heading"><div><span>EXPERIMENT INPUT</span><h2>다중 인원 조건</h2></div></div>
        <div className="multi-counts">{(['S1','S2','S3'] as const).map((id) => <label key={id}>{id} 인원<input aria-label={`${id} 초기 인원`} type="number" min="0" value={counts[id]} onChange={(e) => { setCounts({ ...counts, [id]: Number(e.target.value) }); setResult(null) }} /></label>)}</div>
        <div className="multi-counts">{(['S1','S2','S3'] as const).map((id) => <label key={id}>{id} 출발 지연<input aria-label={`${id} 출발 지연`} type="number" min="0" value={delays[id]} onChange={(e) => { setDelays({ ...delays, [id]: Number(e.target.value) }); setResult(null) }} /></label>)}</div>
        <label>재난·차단 시나리오<select aria-label="다중 인원 시나리오" value={scenarioId} onChange={(e) => { setScenarioId(e.target.value); setResult(null) }}>{scenarioOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <div className="multi-grid"><label>평지 속도 (m/s)<input aria-label="다중 평지 속도" type="number" min=".1" step=".1" value={walk} onChange={(e) => setWalk(Number(e.target.value))} /></label><label>계단 속도 (m/s)<input aria-label="다중 계단 속도" type="number" min=".1" step=".1" value={stair} onChange={(e) => setStair(Number(e.target.value))} /></label><label>평지 용량 (명/초)<input aria-label="평지 가정 용량" type="number" min=".1" step=".1" value={corridorCapacity} onChange={(e) => setCorridorCapacity(Number(e.target.value))} /></label><label>계단 용량 (명/초)<input aria-label="계단 가정 용량" type="number" min=".1" step=".1" value={stairCapacity} onChange={(e) => setStairCapacity(Number(e.target.value))} /></label><label>기록 간격 (초)<input aria-label="시뮬레이션 기록 간격" type="number" min="1" value={timeStep} onChange={(e) => setTimeStep(Number(e.target.value))} /></label><label>최대 경과 (초)<input aria-label="최대 모의 시간" type="number" min="1" value={maxTime} onChange={(e) => setMaxTime(Number(e.target.value))} /></label></div>
        <fieldset className="capacity-override"><legend>통로별 용량 재정의</legend><select aria-label="용량 재정의 구간" value={overrideEdge} onChange={(e) => setOverrideEdge(e.target.value)}><option value="">구간 선택</option>{mapData.edges.map((edge) => <option key={edge.id} value={edge.id}>{edge.id}</option>)}</select><input aria-label="구간 가정 용량" type="number" min=".1" step=".1" value={overrideCapacity} onChange={(e) => setOverrideCapacity(Number(e.target.value))} /><button className="secondary" disabled={!overrideEdge || overrideCapacity <= 0} onClick={() => { setOverrides({ ...overrides, [overrideEdge]: overrideCapacity }); setResult(null) }}>적용</button></fieldset>
        {Object.keys(overrides).length > 0 && <p className="override-list">재정의: {Object.entries(overrides).map(([id, value]) => `${id} ${value}명/초`).join(' · ')}</p>}
        <button onClick={() => void run()} disabled={!valid || loading}>{loading ? '실험 계산 중…' : '차단 전후 비교 실행'}</button>
      </aside></div>
    {result && <div className="multi-output"><div className="multi-result-grid"><ResultCard title="차단 전 기준" result={result.baseline} /><ResultCard title="조건 반영" result={result.scenario} /></div><QueueChart result={result.scenario} /><section className="bottleneck-list"><h3>가정 조건 내 병목 후보</h3>{result.scenario.bottleneck_edge_ids.length ? <ol>{result.scenario.bottleneck_edge_ids.slice(0, 8).map((id) => { const metric = result.scenario.edge_metrics.find((item) => item.edge_id === id); return <li key={id}><strong>{id}</strong><span>최대 대기 {metric?.max_queue_count || 0}명 · 최대 {metric?.max_wait_s || 0}초</span></li> })}</ol> : <p>기록된 대기열이 없습니다.</p>}</section></div>}
  </section>
}
