import { Component, type ErrorInfo, type ReactNode } from 'react'

const RELOAD_KEY = 'ml_chunk_reload_at'

/** After a redeploy, old lazy chunks 404. Reload once to pick up the new build. */
function isChunkLoadError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  )
}

type State = { error: Error | null }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
        if (Date.now() - last > 30000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
          window.location.reload()
          return
        }
      } catch {
        // storage blocked: fall through to the error screen
      }
    }
    console.error('UI error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)] p-6">
        <div className="card p-6 max-w-md space-y-3">
          <h1 className="text-lg font-semibold">Something Went Wrong</h1>
          <p className="text-sm text-[var(--muted)]">
            This screen hit an unexpected error. Your saved data is safe. Reload to continue.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => (window.location.href = '/app')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
