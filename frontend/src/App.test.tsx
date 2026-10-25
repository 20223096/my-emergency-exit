import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { mapFixture, routeFixture, scenarioFixture, unreachableFixture } from './test/fixtures'

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function installFetch(routeResult = routeFixture, availableScenarios = [scenarioFixture]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.endsWith('/api/maps')) return jsonResponse([{ id: mapFixture.id, name: '가상 지도', description: 'test', experimental: true }])
    if (url.endsWith('/api/scenarios')) return jsonResponse(availableScenarios)
    if (url.includes(`/api/maps/${mapFixture.id}`)) return jsonResponse(mapFixture)
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
  })

  it('shows an unreachable route without failing the screen', async () => {
    installFetch(unreachableFixture)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.click(screen.getByRole('button', { name: '경로 계산' }))
    expect(await screen.findAllByText('사용 가능한 경로가 없습니다.')).toHaveLength(1)
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
    expect(screen.getByRole('heading', { name: '내비상구 경로 실험 화면' })).toBeInTheDocument()
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
    expect(screen.getAllByText('아직 계산하지 않았습니다.')).toHaveLength(2)
  })

  it('passes both blocked stairs and renders unreachable without zero values', async () => {
    const twoStairs = {
      ...scenarioFixture,
      id: 'seoul-fire-b-unreachable',
      name: '화재 B · 모든 가정 계단 차단',
      conditions: { blocked_edge_ids: ['STAIR_A', 'STAIR_B'], blocked_exit_ids: [], congestion_delays: {} },
    }
    const fetchMock = installFetch(unreachableFixture, [twoStairs])
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('node-S1')
    await user.selectOptions(screen.getByLabelText('시나리오 선택'), twoStairs.id)
    await user.click(screen.getByRole('button', { name: '기본 경로와 비교' }))
    expect((await screen.findAllByText('사용 가능한 경로가 없습니다.')).length).toBeGreaterThan(0)
    expect(screen.queryByText('0m')).not.toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/routes/compare'))
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ blocked_edge_ids: ['STAIR_A', 'STAIR_B'] })
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
