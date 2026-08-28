interface LoadingSkeletonProps {
  variant: 'dashboard' | 'table' | 'detail'
  rows?: number
}

export function LoadingSkeleton({ variant, rows = 5 }: LoadingSkeletonProps) {
  if (variant === 'dashboard') {
    return (
      <div className="skeleton-dashboard" aria-label="Özet yükleniyor" aria-busy="true" role="status">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton-card" key={index} aria-hidden="true">
            <span className="skeleton-line short" />
            <span className="skeleton-line value" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className="skeleton-detail" aria-label="Detay yükleniyor" aria-busy="true" role="status">
        <span className="skeleton-line title" aria-hidden="true" />
        <div className="skeleton-detail-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <span className="skeleton-block" key={index} />)}
        </div>
      </div>
    )
  }

  return (
    <section className="panel skeleton-table" aria-label="Liste yükleniyor" aria-busy="true" role="status">
      <div className="skeleton-table-header" aria-hidden="true" />
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-table-row" key={index} aria-hidden="true">
          <span className="skeleton-line" />
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
          <span className="skeleton-line" />
        </div>
      ))}
    </section>
  )
}
