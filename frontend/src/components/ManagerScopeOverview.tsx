import { useCallback, useEffect, useState } from 'react'
import { getMyManagerScope } from '../api'
import type { ManagerAssignment } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sorumluluk alanlarınız yüklenemedi.'
}

export function ManagerScopeOverview() {
  const [assignments, setAssignments] = useState<ManagerAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadAssignments = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      setAssignments(await getMyManagerScope())
    } catch (error) {
      setAssignments([])
      setLoadError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  return (
    <section className="manager-scope-overview entity-management-view" aria-busy={isLoading}>
      {!isLoading && !loadError && (
        <p className="manager-scope-summary">
          {assignments.length} aktif sorumluluk alanı gösteriliyor.
        </p>
      )}

      {isLoading && <LoadingSkeleton variant="table" />}

      {!isLoading && loadError && (
        <section className="panel entity-state-panel error-state">
          <p className="status-message error-message" role="alert">{loadError}</p>
          <button className="secondary-button" type="button" onClick={() => void loadAssignments()}>
            Tekrar Dene
          </button>
        </section>
      )}

      {!isLoading && !loadError && assignments.length === 0 && (
        <section className="panel entity-state-panel actionable-empty-state">
          <h2>Aktif sorumluluk alanınız bulunmuyor</h2>
          <p>Size yapı veya blok ataması yapıldığında bu ekranda görüntülenecektir.</p>
        </section>
      )}

      {!isLoading && !loadError && assignments.length > 0 && (
        <section className="panel entity-table-panel">
          <div className="responsive-table-wrapper">
            <table className="management-table manager-scope-table">
              <thead>
                <tr>
                  <th>Yapı</th>
                  <th>Kapsam</th>
                  <th>Blok / Bina</th>
                  <th>Atama Başlangıcı</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><strong>{assignment.propertyName}</strong></td>
                    <td>
                      <span className="status-badge primary-badge">
                        {assignment.scopeType === 'PROPERTY' ? 'Yapı Geneli' : 'Blok'}
                      </span>
                    </td>
                    <td>{assignment.buildingName ?? 'Tüm bloklar'}</td>
                    <td>{formatDate(assignment.assignedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
