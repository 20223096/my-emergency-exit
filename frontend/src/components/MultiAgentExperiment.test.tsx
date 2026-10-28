import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapFixture } from '../test/fixtures'
import type { MultiAgentSimulationResult, Scenario } from '../types/api'
import { MultiAgentExperiment } from './MultiAgentExperiment'

const seoulMap = { ...mapFixture, id: 'seoul-station-line4-prototype-v1' }

const result = (exit = 'EXIT_11'): MultiAgentSimulationResult => ({
  model_name: 'deterministic-fixed-route-fifo-capacity-experiment', model_version: '0.1.0', assumption_notice: 'test',
  total_initial_people: 60, arrived_people: 60, arrivals_by_exit: { [exit]: 60 }, not_arrived_people: 0, no_route_people: 0,
  end_state_counts: { arrived: 60, waiting: 0, in_transit: 0, pending_release: 0, no_route: 0 },
  last_arrival_time_s: 80, average_arrival_time_s: 60, simulation_end_time_s: 80, end_reason: 'ALL_REACHABLE_AGENTS_ARRIVED',
  edge_metrics: [{ edge_id: 'A01', capacity_per_s: 2, admitted_count: 60, max_queue_count: 20, max_wait_s: 10, min_admission_interval_s: .5 }],
  timeline: [{ time_s: 0, total_waiting: 20, edge_queues: { A01: 20 } }, { time_s: 80, total_waiting: 0, edge_queues: {} }],
  bottleneck_edge_ids: ['A01'],
})

const fireA: Scenario = {
  id: 'seoul-fire-a-approach', name: '화재 A', description: 'test', map_id: mapFixture.id, start_node_id: 'S1',
  conditions: { blocked_edge_ids: ['A01'], blocked_exit_ids: [], congestion_delays: {} }, hazard_edge_ids: ['A01'],
}

describe('multi-person experiment mode', () => {
  afterEach(() => vi.restoreAllMocks())

  it('submits assumption inputs and displays queue results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ baseline: result(), scenario: result('EXIT_12') }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const user = userEvent.setup()
    render(<MultiAgentExperiment mapData={seoulMap} scenarios={[fireA]} />)
    await user.click(screen.getByRole('button', { name: '차단 전후 비교 실행' }))
    expect(await screen.findByText('가정 조건 내 병목 후보')).toBeInTheDocument()
    expect(screen.getByText('12번 60명')).toBeInTheDocument()
    expect(screen.getByTestId('edge-A01').querySelector('.is-sim-concentrated')).toBeInTheDocument()
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({ start_counts: { S1: 20, S2: 20, S3: 20 }, corridor_capacity_per_s: 2, stair_capacity_per_s: 1 })
  })

  it('sends selected fire blocking conditions without changing graph data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ baseline: result(), scenario: result() }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const user = userEvent.setup()
    render(<MultiAgentExperiment mapData={seoulMap} scenarios={[fireA]} />)
    await user.selectOptions(screen.getByLabelText('다중 인원 시나리오'), 'seoul-fire-a-approach')
    expect(screen.getByTestId('edge-A01').querySelector('.is-blocked')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '차단 전후 비교 실행' }))
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.blocked_edge_ids).toEqual(['A01'])
  })
})
