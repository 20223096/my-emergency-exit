import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { mapFixture, routeFixture, scenarioFixture, unreachableFixture } from './test/fixtures'

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function installFetch(routeResult = routeFixture) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.endsWith('/api/maps')) return jsonResponse([{ id: mapFixture.id, name: '가상 지도', description: 'test', experimental: true }])
    if (url.endsWith('/api/scenarios')) return jsonResponse([scenarioFixture])
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
    expect(await screen.findByText('사용 가능한 경로가 없습니다.')).toBeInTheDocument()
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
})
