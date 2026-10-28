import { apiRequest } from './client'
import type {
  HealthResponse,
  IndoorMap,
  MapSummary,
  MultiAgentComparisonResult,
  MultiAgentSimulationRequest,
  RouteComparison,
  RouteRequest,
  RouteResult,
  Scenario,
} from '../types/api'

export const getHealth = () => apiRequest<HealthResponse>('/api/health')
export const getMaps = () => apiRequest<MapSummary[]>('/api/maps')
export const getMap = (mapId: string) => apiRequest<IndoorMap>(`/api/maps/${encodeURIComponent(mapId)}`)
export const getScenarios = () => apiRequest<Scenario[]>('/api/scenarios')

export const calculateRoute = (request: RouteRequest) => apiRequest<RouteResult>('/api/routes/calculate', {
  method: 'POST',
  body: JSON.stringify(request),
})

export const compareRoutes = (request: RouteRequest) => apiRequest<RouteComparison>('/api/routes/compare', {
  method: 'POST',
  body: JSON.stringify(request),
})

export const compareMultiAgent = (request: MultiAgentSimulationRequest) => apiRequest<MultiAgentComparisonResult>('/api/multi-agent/compare', {
  method: 'POST',
  body: JSON.stringify(request),
})
