import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { mapFixture, routeFixture, scenarioFixture, unreachableFixture } from './test/fixtures'

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function installFetch(routeResult = routeFixture, availableScenarios = [scenarioFixture], availableMap = mapFixture) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.endsWith('/api/maps')) return jsonResponse([{ id: availableMap.id, name: '가상 지도', description: 'test', experimental: true }])
    if (url.endsWith('/api/scenarios')) return jsonResponse(availableScenarios)
    if (url.includes(`/api/maps/${availableMap.id}`)) return jsonResponse(availableMap)
    if (url.endsWith('/api/routes/calculate')) return jsonResponse(routeResult)
    if (url.endsWith('/api/routes/compare')) return jsonResponse({
      baseline: routeFixture, scenario: routeResult, path_changed: true, exit_changed: false,
      distance_delta_m: 0, total_time_delta_s: 0, change_reasons: ['테스트 변경 사유'],
    })
    return jsonResponse({ detail: `unknown ${url} ${init?.method}` }, 404)
  })
}

describe('development screen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads map data and changes start selection', async () => {
    installFetch()
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByTestId('node-S1')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('시작 위치 선택'), 'S1')
    expect(screen.getByLabelText('시작 위치 선택')).toHaveValue('S1')
  })

  it('applies a selected scenario and calls comparison API', async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.selectOptions(screen.getByLabelText('시나리오 선택'), scenarioFixture.id)
    expect(screen.getByTestId('edge-A01').querySelector('.is-blocked')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본 경로와 비교' }))
    expect(await screen.findByText('테스트 변경 사유')).toBeInTheDocument()
    const compareCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/routes/compare'))
    expect(compareCall).toBeTruthy()
    expect(JSON.parse(String(compareCall?.[1]?.body))).toMatchObject({ blocked_edge_ids: ['A01'] })
    expect(screen.getByText('차단 전 기본 경로')).toBeInTheDocument()
    expect(screen.getByText('차단 후 변경 경로')).toBeInTheDocument()
  })

  it('keeps a single calculation separate from before-and-after comparison cards', async () => {
    installFetch()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.selectOptions(screen.getByLabelText('시나리오 선택'), scenarioFixture.id)
    await user.click(screen.getByRole('button', { name: '경로 계산' }))
    expect((await screen.findAllByText('현재 조건 계산 결과')).length).toBeGreaterThan(0)
    expect(screen.queryByText('차단 전 기본 경로')).not.toBeInTheDocument()
    expect(screen.queryByText('차단 후 변경 경로')).not.toBeInTheDocument()
  })

  it('clears stale calculation results when the start or scenario changes', async () => {
    const secondStartMap = {
      ...mapFixture,
      nodes: [...mapFixture.nodes, { id: 'S2', type: 'START' as const, x: 1, y: 1, floor: 1, label: '두 번째 출발점' }],
    }
    installFetch(routeFixture, [scenarioFixture], secondStartMap)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.click(screen.getByRole('button', { name: '경로 계산' }))
    expect(await screen.findByText('E1')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('시작 위치 선택'), 'S2')
    expect(screen.queryByText('E1')).not.toBeInTheDocument()
    expect(screen.getByText('아직 계산하지 않았습니다.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('시나리오 선택'), scenarioFixture.id)
    expect(screen.getByText('아직 계산하지 않았습니다.')).toBeInTheDocument()
  })

  it('shows an unreachable route without failing the screen', async () => {
    installFetch(unreachableFixture)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.click(screen.getByRole('button', { name: '경로 계산' }))
    expect(await screen.findAllByText('이동 가능한 경로 없음')).toHaveLength(1)
  })

  it('shows a structured message when map API loading fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/api/scenarios')) return jsonResponse([])
      return jsonResponse({ detail: '지도를 찾을 수 없습니다.' }, 404)
    })
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('not_found')
    expect(screen.getByRole('alert')).toHaveTextContent('지도를 찾을 수 없습니다.')
  })

  it('shows a network error and keeps the page mounted', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('connection failed'))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('network')
    expect(screen.getByRole('heading', { name: '내비상구 · 경로 비교 시연' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('데이터를 처리하고 있습니다…')).not.toBeInTheDocument())
  })

  it('adds congestion to the comparison request and reset clears it', async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.selectOptions(screen.getByLabelText('혼잡 구간 선택'), 'A06')
    await user.clear(screen.getByLabelText('혼잡 추가 지연'))
    await user.type(screen.getByLabelText('혼잡 추가 지연'), '20')
    await user.click(screen.getByRole('button', { name: '혼잡 지연 추가' }))
    await user.click(screen.getByRole('button', { name: '기본 경로와 비교' }))
    await screen.findByText('테스트 변경 사유')
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/routes/compare'))
    expect(JSON.parse(String(calls.at(-1)?.[1]?.body))).toMatchObject({
      congestion_delays: { A06: 20 }, stair_speed_mps: 0.8,
    })
    await user.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByLabelText('혼잡 구간 선택')).toHaveValue('')
    expect(screen.getAllByText('아직 계산하지 않았습니다.')).toHaveLength(1)
  })

  it('passes both blocked stairs and renders unreachable without zero values', async () => {
    const demoMap = {
      ...mapFixture,
      id: 'seoul-station-line4-prototype-v1',
      nodes: [
        ...mapFixture.nodes,
        { id: 'S3', type: 'START' as const, x: 2, y: 3, floor: 2, label: '승강장 출발점' },
      ],
      edges: [
        ...mapFixture.edges,
        { id: 'STAIR_A', source: 'S3', target: 'J1', length_m: 14, type: 'STAIR' as const, bidirectional: true },
        { id: 'STAIR_B', source: 'S3', target: 'T1', length_m: 16, type: 'STAIR' as const, bidirectional: true },
      ],
    }
    const twoStairs = {
      ...scenarioFixture,
      id: 'seoul-fire-b-unreachable',
      name: '대피 경로 없음 테스트 · 계단 A+B 차단',
      description: 'S3에서 두 계단을 모두 차단합니다.',
      map_id: demoMap.id,
      start_node_id: 'S3',
      conditions: { blocked_edge_ids: ['STAIR_A', 'STAIR_B'], blocked_exit_ids: [], congestion_delays: {} },
    }
    const fetchMock = installFetch(unreachableFixture, [twoStairs], demoMap)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.selectOptions(screen.getByLabelText('시나리오 선택'), twoStairs.id)
    expect(screen.getByLabelText('시작 위치 선택')).toHaveValue('S3')
    expect(screen.getByTestId('edge-STAIR_A').querySelector('.is-blocked')).toBeInTheDocument()
    expect(screen.getByTestId('edge-STAIR_B').querySelector('.is-blocked')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본 경로와 비교' }))
    expect(await screen.findByText('이동 가능한 경로 없음')).toBeInTheDocument()
    expect(screen.queryByText('0m')).not.toBeInTheDocument()
    expect(screen.getByTestId('baseline-A01')).toBeInTheDocument()
    expect(document.querySelector('.route-scenario')).not.toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/routes/compare'))
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      start_node_id: 'S3', blocked_edge_ids: ['STAIR_A', 'STAIR_B'],
    })
  })

  it('restores default in-memory controls after a browser-style remount', async () => {
    installFetch()
    const user = userEvent.setup()
    const first = render(<App />)
    await screen.findByTestId('node-S1')
    await user.selectOptions(screen.getByLabelText('시나리오 선택'), scenarioFixture.id)
    await user.clear(screen.getByLabelText('혼잡 추가 지연'))
    await user.type(screen.getByLabelText('혼잡 추가 지연'), '77')
    first.unmount()

    render(<App />)
    await screen.findByTestId('node-S1')
    expect(screen.getByLabelText('시나리오 선택')).toHaveValue('')
    expect(screen.getByLabelText('혼잡 추가 지연')).toHaveValue(30)
    expect(screen.getByLabelText('평지 이동속도')).toHaveValue(1.2)
    expect(screen.getByLabelText('계단 이동속도')).toHaveValue(0.8)
  })
})
