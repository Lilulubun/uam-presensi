import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  componentStack: string | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, componentStack: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, componentStack: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <FallbackError error={this.state.error} componentStack={this.state.componentStack} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

function FallbackError({ error, componentStack, onRetry }: { error: Error | null; componentStack: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Terjadi Kesalahan</h2>
        {error && (
          <div className="text-xs font-mono bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-left break-all">
            <p className="font-bold mb-1">{error.name}</p>
            <p className="mb-2">{error.message}</p>
            {componentStack && (
              <details>
                <summary className="cursor-pointer font-bold text-blue-700">Component Stack</summary>
                <pre className="mt-1 whitespace-pre-wrap text-[10px]">
                  {componentStack}
                </pre>
              </details>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          Silakan coba lagi atau laporkan error di atas.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Coba Lagi
        </Button>
      </div>
    </div>
  )
}
