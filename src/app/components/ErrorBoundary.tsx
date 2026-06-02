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
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <FallbackError onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

function FallbackError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Terjadi Kesalahan</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Terjadi kesalahan yang tidak terduga. Silakan coba lagi.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Coba Lagi
        </Button>
      </div>
    </div>
  )
}
