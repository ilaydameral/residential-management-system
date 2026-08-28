import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  action,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`page-header-row app-page-header ${className}`.trim()}>
      <div className="app-page-header-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="app-page-header-subtitle">{subtitle}</p>}
        {meta && <p className="page-header-meta">{meta}</p>}
      </div>
      {action && <div className="app-page-header-action">{action}</div>}
    </header>
  )
}
