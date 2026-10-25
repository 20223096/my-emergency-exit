import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapCanvas } from './MapCanvas'
import { mapFixture, routeFixture } from '../test/fixtures'

describe('MapCanvas', () => {
  it('renders every node and edge', () => {
    render(<MapCanvas mapData={mapFixture} />)
    mapFixture.nodes.forEach((node) => expect(screen.getByTestId(`node-${node.id}`)).toBeInTheDocument())
    mapFixture.edges.forEach((edge) => expect(screen.getByTestId(`edge-${edge.id}`)).toBeInTheDocument())
  })

  it('highlights baseline and scenario routes by edge ID', () => {
    render(<MapCanvas mapData={mapFixture} baselineRoute={routeFixture} scenarioRoute={routeFixture} />)
    expect(screen.getByTestId('baseline-A01')).toBeInTheDocument()
    expect(screen.getByTestId('scenario-A06')).toBeInTheDocument()
  })

  it('shows blocked, closed exit, congestion, and selected start independently', () => {
    render(<MapCanvas mapData={mapFixture} blockedEdgeIds={['A01']} blockedExitIds={['E1']}
      congestionDelays={{ A06: 12 }} selectedStartNodeId="S1" />)
    expect(screen.getByTestId('edge-A01').querySelector('.is-blocked')).toBeInTheDocument()
    expect(screen.getByLabelText('A01 차단')).toBeInTheDocument()
    expect(screen.getByTestId('edge-A06').querySelector('.is-congested')).toBeInTheDocument()
    expect(screen.getByText('+12s')).toBeInTheDocument()
    expect(screen.getByTestId('node-E1')).toHaveClass('is-closed')
    expect(screen.getByTestId('node-S1')).toHaveClass('is-selected')
  })

  it('renders A12 and A17 as separate curved SVG paths', () => {
    render(<MapCanvas mapData={mapFixture} blockedEdgeIds={['A12']} />)
    const a12 = screen.getByTestId('edge-A12').querySelector('path')
    const a17 = screen.getByTestId('edge-A17').querySelector('path')
    expect(a12).toHaveAttribute('d', expect.stringContaining('Q'))
    expect(a17).toHaveAttribute('d', expect.stringContaining('Q'))
    expect(a12?.getAttribute('d')).not.toBe(a17?.getAttribute('d'))
    expect(a12).toHaveClass('is-blocked')
    expect(a17).not.toHaveClass('is-blocked')
    expect(a17).toHaveAttribute('marker-end', 'url(#arrow)')
  })

  it('filters nodes and edges by floor', () => {
    render(<MapCanvas mapData={mapFixture} floor={2} />)
    expect(screen.getByTestId('node-T1')).toBeInTheDocument()
    expect(screen.queryByTestId('node-S1')).not.toBeInTheDocument()
    expect(screen.getByTestId('edge-A12')).toBeInTheDocument()
  })

  it('marks a fire location as a simulation hazard', () => {
    render(<MapCanvas mapData={mapFixture} hazardEdgeIds={['A01']} />)
    expect(screen.getByTestId('edge-A01').querySelector('.is-hazard')).toBeInTheDocument()
    expect(screen.getByLabelText('A01 화재 가정 위치')).toBeInTheDocument()
    expect(screen.getByText('화재 가정')).toBeInTheDocument()
  })

  it('shows Seoul exit names without replacing the API ID', () => {
    const seoulMap = {
      ...mapFixture,
      id: 'seoul-station-line4-prototype-v1',
      nodes: mapFixture.nodes.map((node) => node.id === 'E1'
        ? { ...node, id: 'EXIT_11', label: '11번 출구 후보' }
        : node),
      edges: mapFixture.edges.map((edge) => ({
        ...edge,
        source: edge.source === 'E1' ? 'EXIT_11' : edge.source,
        target: edge.target === 'E1' ? 'EXIT_11' : edge.target,
      })),
    }
    render(<MapCanvas mapData={seoulMap} />)
    expect(screen.getByTestId('node-EXIT_11')).toBeInTheDocument()
    expect(screen.getByText('11번 출구')).toBeInTheDocument()
    expect(screen.getByText('EXIT_11: 11번 출구 후보, 1층, EXIT')).toBeInTheDocument()
  })
})
