import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const timeoutRef = useRef<number | null>(null)

  const dismissToast = useCallback(() => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setMessage('')
  }, [])

  const showToast = useCallback((nextMessage: string) => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current)
    setMessage(nextMessage)
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      setMessage('')
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
        {message && (
          <div className="app-toast" role="status">
            <span className="toast-indicator" aria-hidden="true">✓</span>
            <span>{message}</span>
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
