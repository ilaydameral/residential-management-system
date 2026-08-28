import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

type ToastVariant = 'success' | 'error' | 'info'

interface ToastState {
  message: string
  variant: ToastVariant
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const dismissToast = useCallback(() => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    setToast({ message, variant })
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      setToast(null)
    }, 3500)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`app-toast toast-${toast.variant}`} role={toast.variant === 'error' ? 'alert' : 'status'}>
            <span className="toast-indicator" aria-hidden="true">
              {toast.variant === 'success' ? '✓' : toast.variant === 'error' ? '!' : 'i'}
            </span>
            <span>{toast.message}</span>
            <button type="button" aria-label="Bildirimi kapat" onClick={dismissToast}>×</button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
