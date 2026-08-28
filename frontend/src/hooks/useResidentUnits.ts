import { useState, useEffect, useCallback } from 'react'
import { getMyUnits } from '../api'
import type { ResidentUnit } from '../types'
import { groupResidentUnits, type GroupedResidentUnit } from '../utils/residentUnits'

export function useResidentUnits() {
  const [units, setUnits] = useState<ResidentUnit[]>([])
  const [groupedUnits, setGroupedUnits] = useState<GroupedResidentUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUnits = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getMyUnits()
      const list = Array.isArray(data) ? data : []
      setUnits(list)
      setGroupedUnits(groupResidentUnits(list))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daire bilgileri yüklenemedi.')
      setUnits([])
      setGroupedUnits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  return {
    units,
    groupedUnits,
    loading,
    error,
    refetch: loadUnits,
  }
}
