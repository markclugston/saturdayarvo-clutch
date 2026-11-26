import { useQueryClient } from '@tanstack/react-query'
import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ContentPanel } from '@/components/ui/content-panel'
import { ErrorMessage } from '@/components/ui/error-message'
import { cn } from '@/lib/utils'

/** Where the boundary sits, which decides the message and the surface around it. */
type Placement = 'content' | 'panel' | 'app'

const contentMessages = {
  failed: 'This content could not be displayed. Unsaved changes in it may be lost. Try again, or choose another page from the navigation.',
  retried: 'This content failed to display again. Unsaved changes in it may be lost. Choose another page from the navigation, or try again later.',
}

const messages: Record<Placement, typeof contentMessages> = {
  content: contentMessages,
  panel: contentMessages,
  app: {
    failed: 'Clutch could not be displayed. Unsaved changes may be lost. Try again, or reload the page.',
    retried: 'Clutch failed to display again. Unsaved changes may be lost. Reload the page, or try again later.',
  },
}

type PageErrorBoundaryProps = {
  children: ReactNode
  /** The content is pinned outside the content panel, so the message brings its own panel surface. */
  panel?: boolean
}

export function PageErrorBoundary({ children, panel }: PageErrorBoundaryProps) {
  return <RetryableBoundary placement={panel ? 'panel' : 'content'}>{children}</RetryableBoundary>
}

/** The last line of defence, for anything outside the page content such as the header or sign-in screen. */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <RetryableBoundary placement="app">{children}</RetryableBoundary>
}

function RetryableBoundary(props: { children: ReactNode; placement: Placement }) {
  const queryClient = useQueryClient()
  // The failed content has unmounted, so its queries are inactive. Dropping them makes the retry load
  // fresh data instead of failing again on the same cached values.
  return <ErrorBoundary {...props} onRetry={() => queryClient.removeQueries({ type: 'inactive' })} />
}

type ErrorBoundaryProps = { children: ReactNode; placement: Placement; onRetry: () => void }

type ErrorBoundaryState = { failed: boolean; retried: boolean }

/**
 * The approved class component (WEB-001): React has no hook that catches render errors.
 * The error itself is never stored, shown or logged, because it can carry sensitive data (SEC-003).
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, retried: false }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  // `retried` stays set until the boundary is replaced: retried content usually shows a loading step
  // before it fails again, and that must still read as a repeat failure.
  retry = () => {
    this.props.onRetry()
    this.setState({ failed: false, retried: true })
  }

  render() {
    if (!this.state.failed) return this.props.children

    const { placement } = this.props
    const message = (
      <div
        className={cn(
          'flex flex-col items-start gap-4',
          placement === 'panel' && 'm-2 mt-0 ml-0 shrink-0 rounded-panel bg-content p-4 lg:m-3 lg:mt-0 lg:ml-0 xl:p-6',
        )}
      >
        <ErrorMessage>{messages[placement][this.state.retried ? 'retried' : 'failed']}</ErrorMessage>
        {/* The focused control was removed with the failed content, so focus moves to the way out. */}
        <Button autoFocus onClick={this.retry} type="button" variant="secondary">
          Try Again
        </Button>
      </div>
    )

    // With no app shell left, the message supplies the page: canvas, then a content panel.
    return placement === 'app'
      ? <div className="flex min-h-svh flex-col"><ContentPanel>{message}</ContentPanel></div>
      : message
  }
}
