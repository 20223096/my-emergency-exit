import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getMap, getMaps, getScenarios } from '../api/routes'
import type { IndoorMap, MapSummary, Scenario } from '../types/api'

export function useMapData() {
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [mapData, setMapData] = useState<IndoorMap | null>(null)
  const [selectedMapId, setSelectedMapId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getMaps(), getScenarios()])
      .then(([availableMaps, availableScenarios]) => {
        if (!active) return
        setMaps(availableMaps)
        setScenarios(availableScenarios)
        setSelectedMapId((current) => current || availableMaps[0]?.id || '')
        setError(null)
      })
      .catch((reason: unknown) => active && setError(
        reason instanceof ApiError ? reason : new ApiError('초기 데이터를 불러오지 못했습니다.', 'server', null, reason),
      ))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedMapId) {
      setMapData(null)
      return
    }
    let active = true
    setLoading(true)
    getMap(selectedMapId)
      .then((data) => {
        if (!active) return
        setMapData(data)
        setError(null)
      })
      .catch((reason: unknown) => active && setError(
        reason instanceof ApiError ? reason : new ApiError('지도 데이터를 불러오지 못했습니다.', 'server', null, reason),
      ))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [selectedMapId])

  return { maps, scenarios, mapData, selectedMapId, setSelectedMapId, loading, error }
}
