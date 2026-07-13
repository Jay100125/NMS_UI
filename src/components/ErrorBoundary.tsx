import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null; info: string | null }

/**
 * Catches render/lifecycle errors in the routed content so a crash shows a
 * readable message instead of a blank white page. Displays the error and the
 * React component stack to make the failing component obvious.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    this.setState({ info: info.componentStack ?? null })
    // Also surface it in the console for good measure.
    console.error('[ErrorBoundary] caught:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <h2 className="mb-2 text-lg font-semibold">Something crashed on this screen</h2>
          <p className="mb-3 font-mono text-sm break-words">{this.state.error.message}</p>
          {this.state.error.stack && (
            <pre className="mb-3 max-h-48 overflow-auto rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-white/5">{this.state.error.stack}</pre>
          )}
          {this.state.info && (
            <details open>
              <summary className="cursor-pointer text-sm font-medium">Component stack</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-white/5">{this.state.info}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
