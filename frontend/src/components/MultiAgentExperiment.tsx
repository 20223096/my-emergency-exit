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

const END_REASON_LABELS: Record<string, { title: string; detail: string }> = {
  ALL_REACHABLE_AGENTS_ARRIVED: { title: '모든 인원이 도착했습니다', detail: '현재 가정과 제한시간 안에서 경로가 있는 모든 인원이 도착했습니다.' },
  COMPLETED_WITH_NO_ROUTE_AGENTS: { title: '일부 인원은 경로가 없습니다', detail: '도착한 인원과 처음부터 이용 가능한 경로가 없는 인원이 함께 있습니다.' },
  NO_REACHABLE_ROUTES: { title: '이용 가능한 경로가 없습니다', detail: '차단 조건 때문에 출발 시점부터 출구까지 연결된 경로를 찾지 못했습니다.' },
  TIMEOUT_WITH_ACTIVE_AGENTS: { title: '제한시간에 실험이 종료됐습니다', detail: '경로는 있지만 제한시간 종료 시 대기·이동·출발 전 인원이 남았습니다.' },
  NO_AGENTS: { title: '실험 인원이 없습니다', detail: '초기 인원을 1명 이상 입력해 주세요.' },
}

function endReason(result: MultiAgentSimulationResult) { return END_REASON_LABELS[result.end_reason] || { title: '실험이 종료됐습니다', detail: `기록된 상태: ${result.end_reason}` } }
function timeoutPeople(result: MultiAgentSimulationResult) { return (result.end_state_counts.waiting || 0) + (result.end_state_counts.in_transit || 0) + (result.end_state_counts.pending_release || 0) }
function exits(result: MultiAgentSimulationResult) { return Object.entries(result.arrivals_by_exit).map(([id, count]) => `${id.replace('EXIT_', '')}번 출구 ${count}명`).join(' · ') || '선택된 출구 없음' }
function average(result: MultiAgentSimulationResult) {
  if (result.average_arrival_time_s == null) return { value: '—', note: '도착자 없음' }
  return { value: `${result.average_arrival_time_s}초`, note: result.arrived_people === result.total_initial_people ? '전체 도착 인원 평균' : `도착한 ${result.arrived_people}명만의 평균` }
}
function edgeName(mapData: IndoorMap, edgeId: string) {
  const edge = mapData.edges.find((item) => item.id === edgeId); if (!edge) return '구간명 미확인'
  const nodes = new Map(mapData.nodes.map((node) => [node.id, node.label]))
  return `${nodes.get(edge.source) || edge.source} ↔ ${nodes.get(edge.target) || edge.target}`
}
function bottleneckSummary(result: MultiAgentSimulationResult, mapData: IndoorMap) {
  const id = result.bottleneck_edge_ids[0]; if (!id) return '기록된 대기열 없음'
  const metric = result.edge_metrics.find((item) => item.edge_id === id)
  return `${id} · ${edgeName(mapData, id)} · 최대 ${metric?.max_queue_count || 0}명`
}

function ComparisonTable({ comparison, mapData }: { comparison: MultiAgentComparisonResult; mapData: IndoorMap }) {
  const rows = [
    ['도착 인원', `${comparison.baseline.arrived_people} / ${comparison.baseline.total_initial_people}명`, `${comparison.scenario.arrived_people} / ${comparison.scenario.total_initial_people}명`],
    ['경로 없음', `${comparison.baseline.no_route_people}명`, `${comparison.scenario.no_route_people}명`],
    ['시간 제한 미도착', `${timeoutPeople(comparison.baseline)}명`, `${timeoutPeople(comparison.scenario)}명`],
    ['평균 도착 모의 시간', average(comparison.baseline), average(comparison.scenario)],
    ['마지막 도착 모의 시간', comparison.baseline.last_arrival_time_s == null ? '—' : `${comparison.baseline.last_arrival_time_s}초`, comparison.scenario.last_arrival_time_s == null ? '—' : `${comparison.scenario.last_arrival_time_s}초`],
    ['선택된 출구', exits(comparison.baseline), exits(comparison.scenario)],
    ['주요 병목 후보', bottleneckSummary(comparison.baseline, mapData), bottleneckSummary(comparison.scenario, mapData)],
  ] as const
  return <section className="comparison-panel" aria-label="차단 전후 결과 비교"><div className="comparison-heading"><div><span>RESULT COMPARISON</span><h2>차단 전후 한눈에 비교</h2></div><p>평균은 도착한 인원만 계산합니다.</p></div><div className="comparison-scroll"><table><thead><tr><th>지표</th><th>차단 전 기준</th><th>조건 반영</th></tr></thead><tbody>{rows.map(([label, baseline, scenario]) => <tr key={label}><th>{label}</th>{[baseline, scenario].map((value, index) => <td key={index}>{typeof value === 'object' ? <><strong>{value.value}</strong><small>{value.note}</small></> : value}</td>)}</tr>)}</tbody></table></div><div className="end-reason-grid">{([comparison.baseline, comparison.scenario] as const).map((item, index) => { const reason = endReason(item); return <article className={`end-reason ${item.end_reason === 'TIMEOUT_WITH_ACTIVE_AGENTS' || item.no_route_people > 0 ? 'is-warning' : ''}`} key={index}><span>{index === 0 ? '차단 전 기준' : '조건 반영'}</span><strong>{reason.title}</strong><p>{reason.detail}</p></article> })}</div></section>
}

function QueueChart({ comparison }: { comparison: MultiAgentComparisonResult }) {
  const width = 720; const height = 250; const plot = { left: 48, right: 16, top: 20, bottom: 38 }
  const all = [...comparison.baseline.timeline, ...comparison.scenario.timeline]
  if (!all.length) return <section className="queue-chart empty"><h3>시간별 모의 대기 인원</h3><p>표시할 시간별 대기열 기록이 없습니다.</p></section>
  const maxTime = Math.max(1, ...all.map((point) => point.time_s)); const observedMax = Math.max(0, ...all.map((point) => point.total_waiting)); const scaleMax = Math.max(1, observedMax)
  const x = (time: number) => plot.left + (time / maxTime) * (width - plot.left - plot.right); const y = (count: number) => plot.top + (1 - count / scaleMax) * (height - plot.top - plot.bottom)
  const line = (result: MultiAgentSimulationResult) => result.timeline.map((point) => `${x(point.time_s)},${y(point.total_waiting)}`).join(' ')
  const timeRows = [...new Set(all.map((point) => point.time_s))].sort((a, b) => a - b); const lookup = (result: MultiAgentSimulationResult, time: number) => result.timeline.find((point) => point.time_s === time)?.total_waiting
  const baselineMax = Math.max(0, ...comparison.baseline.timeline.map((point) => point.total_waiting)); const scenarioMax = Math.max(0, ...comparison.scenario.timeline.map((point) => point.total_waiting))
  return <section className="queue-chart"><div className="queue-chart-heading"><div><span>QUEUE OVER TIME</span><h3>시간별 모의 대기 인원</h3></div><div className="chart-legend"><span className="baseline">차단 전 최대 {baselineMax}명</span><span className="scenario">조건 반영 최대 {scenarioMax}명</span></div></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="차단 전후 시간별 모의 대기 인원 비교 그래프"><line className="axis" x1={plot.left} y1={height - plot.bottom} x2={width - plot.right} y2={height - plot.bottom} /><line className="axis" x1={plot.left} y1={plot.top} x2={plot.left} y2={height - plot.bottom} /><text className="axis-label" x={width / 2} y={height - 5}>경과시간(초)</text><text className="axis-label y" x="12" y={height / 2}>대기 인원(명)</text><text className="tick" x={plot.left} y={height - 20}>0</text><text className="tick" x={width - plot.right} y={height - 20} textAnchor="end">{maxTime}</text><text className="tick" x={plot.left - 8} y={y(observedMax)} textAnchor="end">{observedMax}</text><polyline className="baseline-line" points={line(comparison.baseline)} /><polyline className="scenario-line" points={line(comparison.scenario)} />{comparison.baseline.timeline.map((point) => <circle className="baseline-point" key={`b-${point.time_s}`} cx={x(point.time_s)} cy={y(point.total_waiting)} r="3"><title>차단 전 {point.time_s}초: {point.total_waiting}명</title></circle>)}{comparison.scenario.timeline.map((point) => <circle className="scenario-point" key={`s-${point.time_s}`} cx={x(point.time_s)} cy={y(point.total_waiting)} r="3"><title>조건 반영 {point.time_s}초: {point.total_waiting}명</title></circle>)}</svg><details><summary>시간별 값 표 보기</summary><div className="queue-table-scroll"><table><thead><tr><th>경과시간(초)</th><th>차단 전(명)</th><th>조건 반영(명)</th></tr></thead><tbody>{timeRows.map((time) => <tr key={time}><th>{time}</th><td>{lookup(comparison.baseline, time) ?? '—'}</td><td>{lookup(comparison.scenario, time) ?? '—'}</td></tr>)}</tbody></table></div></details><p className="chart-note">입력 가정으로 계산한 대기열이며 실제 군중 밀도나 실측 혼잡도가 아닙니다.</p></section>
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
  const queueCounts = useMemo(() => Object.fromEntries(result?.scenario.edge_metrics.map((metric) => [metric.edge_id, metric.max_queue_count]) || []), [result])
  const peakQueueEdges = useMemo(() => {
    if (!result?.scenario.edge_metrics.length) return []
    const maximum = Math.max(...result.scenario.edge_metrics.map((metric) => metric.max_queue_count))
    return maximum > 0 ? result.scenario.edge_metrics.filter((metric) => metric.max_queue_count === maximum).map((metric) => metric.edge_id) : []
  }, [result])
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
    <div className="multi-layout"><div className="multi-map"><MapCanvas mapData={mapData} blockedEdgeIds={conditions.blocked_edge_ids} blockedExitIds={conditions.blocked_exit_ids} hazardEdgeIds={selectedScenario?.hazard_edge_ids || []} simulatedQueueLevels={queueLevels} simulatedQueueCounts={queueCounts} highlightedQueueEdgeIds={peakQueueEdges} /><p>색상과 최대 대기열 강조는 이번 입력의 가정 결과이며 실제 혼잡·위험 지점이나 안내 설치 위치가 아닙니다.</p></div>
      <aside className="multi-controls panel"><div className="panel-heading"><div><span>EXPERIMENT INPUT</span><h2>다중 인원 조건</h2></div></div>
        <div className="multi-counts">{(['S1','S2','S3'] as const).map((id) => <label key={id}>{id} 인원<input aria-label={`${id} 초기 인원`} type="number" min="0" value={counts[id]} onChange={(e) => { setCounts({ ...counts, [id]: Number(e.target.value) }); setResult(null) }} /></label>)}</div>
        <div className="multi-counts">{(['S1','S2','S3'] as const).map((id) => <label key={id}>{id} 출발 지연<input aria-label={`${id} 출발 지연`} type="number" min="0" value={delays[id]} onChange={(e) => { setDelays({ ...delays, [id]: Number(e.target.value) }); setResult(null) }} /></label>)}</div>
        <label>재난·차단 시나리오<select aria-label="다중 인원 시나리오" value={scenarioId} onChange={(e) => { setScenarioId(e.target.value); setResult(null) }}>{scenarioOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <div className="multi-grid"><label>평지 속도 (m/s)<input aria-label="다중 평지 속도" type="number" min=".1" step=".1" value={walk} onChange={(e) => setWalk(Number(e.target.value))} /></label><label>계단 속도 (m/s)<input aria-label="다중 계단 속도" type="number" min=".1" step=".1" value={stair} onChange={(e) => setStair(Number(e.target.value))} /></label><label>평지 용량 (명/초)<input aria-label="평지 가정 용량" type="number" min=".1" step=".1" value={corridorCapacity} onChange={(e) => setCorridorCapacity(Number(e.target.value))} /></label><label>계단 용량 (명/초)<input aria-label="계단 가정 용량" type="number" min=".1" step=".1" value={stairCapacity} onChange={(e) => setStairCapacity(Number(e.target.value))} /></label><label>기록 간격 (초)<input aria-label="시뮬레이션 기록 간격" type="number" min="1" value={timeStep} onChange={(e) => setTimeStep(Number(e.target.value))} /></label><label>최대 경과 (초)<input aria-label="최대 모의 시간" type="number" min="1" value={maxTime} onChange={(e) => setMaxTime(Number(e.target.value))} /></label></div>
        <fieldset className="capacity-override"><legend>통로별 용량 재정의</legend><select aria-label="용량 재정의 구간" value={overrideEdge} onChange={(e) => setOverrideEdge(e.target.value)}><option value="">구간 선택</option>{mapData.edges.map((edge) => <option key={edge.id} value={edge.id}>{edge.id}</option>)}</select><input aria-label="구간 가정 용량" type="number" min=".1" step=".1" value={overrideCapacity} onChange={(e) => setOverrideCapacity(Number(e.target.value))} /><button className="secondary" disabled={!overrideEdge || overrideCapacity <= 0} onClick={() => { setOverrides({ ...overrides, [overrideEdge]: overrideCapacity }); setResult(null) }}>적용</button></fieldset>
        {Object.keys(overrides).length > 0 && <p className="override-list">재정의: {Object.entries(overrides).map(([id, value]) => `${id} ${value}명/초`).join(' · ')}</p>}
        <button onClick={() => void run()} disabled={!valid || loading}>{loading ? '실험 계산 중…' : '차단 전후 비교 실행'}</button>
      </aside></div>
    {result && <div className="multi-output"><ComparisonTable comparison={result} mapData={mapData} /><QueueChart comparison={result} /><section className="bottleneck-list"><div><h3>가정 조건 내 병목 후보</h3><p>조건 반영 결과의 FIFO 대기열이 큰 순서입니다.</p></div>{result.scenario.bottleneck_edge_ids.length ? <ol>{result.scenario.bottleneck_edge_ids.slice(0, 8).map((id, index) => { const metric = result.scenario.edge_metrics.find((item) => item.edge_id === id); return <li className={peakQueueEdges.includes(id) ? 'is-peak' : ''} key={id}><span className="bottleneck-rank">{index + 1}</span><div><strong>{id}</strong><small>{edgeName(mapData, id)}</small></div><span>최대 대기 {metric?.max_queue_count || 0}명<br />최대 대기시간 {metric?.max_wait_s || 0}초</span></li> })}</ol> : <p className="empty-copy">현재 기록 간격에서 발생한 대기열이 없습니다.</p>}<small className="bottleneck-disclaimer">실제 서울역의 위험 지점이나 안내 설치 후보를 의미하지 않습니다.</small></section></div>}
  </section>
}
