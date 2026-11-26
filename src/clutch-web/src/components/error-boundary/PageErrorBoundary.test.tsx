import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary, PageErrorBoundary } from './PageErrorBoundary'
import { rootErrorOptions } from './rootErrorOptions'

const marker = 'secret-marker balance 482,913.07'
const firstMessage = 'This content could not be displayed. Unsaved changes in it may be lost. '
  + 'Try again, or choose another page from the navigation.'
const retriedMessage = 'This content failed to display again. Unsaved changes in it may be lost. '
  + 'Choose another page from the navigation, or try again later.'

// The handlers main.tsx uses, so the console assertions cover what the app prints. Testing Library's
// render does not take onUncaughtError; it is tested by calling it.
const renderOptions = {
  onCaughtError: rootErrorOptions.onCaughtError,
  onRecoverableError: rootErrorOptions.onRecoverableError,
}

let failing = true

function Page() {
  if (failing) throw new Error(marker)
  return <h2>Healthy Page</h2>
}

function CrashingForm() {
  const [crashed, setCrashed] = useState(false)
  if (crashed) throw new Error(marker)
  return <button onClick={() => setCrashed(true)} type="button">Crash</button>
}

function renderBoundary(ui: ReactElement, queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})) {
  return render(
    <QueryClientProvider client={queryClient}>
      <PageErrorBoundary>{ui}</PageErrorBoundary>
    </QueryClientProvider>,
    renderOptions,
  )
}

function spyOnConsole() {
  return (['error', 'warn', 'log', 'info', 'debug'] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined))
}

describe('PageErrorBoundary', () => {
  let consoleSpies: ReturnType<typeof spyOnConsole>

  beforeEach(() => {
    failing = true
    consoleSpies = spyOnConsole()
  })

  const consoleArguments = () => consoleSpies.flatMap((spy) => spy.mock.calls.flat())

  it('renders its content when nothing fails', () => {
    failing = false
    renderBoundary(<Page />)

    expect(screen.getByRole('heading', { name: 'Healthy Page' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces a generic message and focuses Try Again when content fails', () => {
    renderBoundary(<Page />)

    expect(screen.getByRole('alert')).toHaveTextContent(firstMessage)
    expect(screen.getByRole('button', { name: 'Try Again' })).toHaveFocus()
  })

  it('shows nothing from the error on screen', () => {
    renderBoundary(<Page />)

    expect(document.body.innerHTML).not.toContain('secret-marker')
    expect(document.body.innerHTML).not.toContain('482,913.07')
    expect(document.body.innerHTML).not.toContain('Page')
  })

  it('writes only a fixed notice to the console', () => {
    renderBoundary(<Page />)

    expect(consoleArguments()).toEqual(['Part of the page could not be displayed.'])
  })

  it('writes only a fixed notice for a failure React recovers from', () => {
    rootErrorOptions.onRecoverableError?.(new Error(marker), { componentStack: marker })

    expect(consoleArguments()).toEqual(['The page recovered from a display problem.'])
  })

  it('writes only a fixed notice for a failure no boundary catches', () => {
    rootErrorOptions.onUncaughtError?.(new Error(marker), { componentStack: marker })

    expect(consoleArguments()).toEqual(['Clutch stopped because of a display problem.'])
  })

  it('shows an app message when the app itself fails, then says it failed again', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AppErrorBoundary><Page /></AppErrorBoundary>
      </QueryClientProvider>,
      renderOptions,
    )
    const alert = () => screen.getByRole('alert')

    expect(screen.getByRole('main')).toContainElement(alert())
    expect(alert()).toHaveTextContent(
      'Clutch could not be displayed. Unsaved changes may be lost. Try again, or reload the page.')
    expect(screen.getByRole('button', { name: 'Try Again' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(alert()).toHaveTextContent(
      'Clutch failed to display again. Unsaved changes may be lost. Reload the page, or try again later.')
    expect(document.body.innerHTML).not.toContain('secret-marker')
    expect(consoleArguments().join()).not.toContain('secret-marker')
  })

  it('redisplays the content when a retry succeeds', async () => {
    const user = userEvent.setup()
    renderBoundary(<Page />)

    failing = false
    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(screen.getByRole('heading', { name: 'Healthy Page' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says the content failed again when a retry fails', async () => {
    const user = userEvent.setup()
    renderBoundary(<Page />)

    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(screen.getByRole('alert')).toHaveTextContent(retriedMessage)
    expect(screen.getByRole('button', { name: 'Try Again' })).toHaveFocus()
  })

  // A retried page usually shows a loading step before it fails again, so one displayed render
  // between the two failures must not bring the first message back.
  it('says the content failed again when it displays for a moment after a retry', async () => {
    const user = userEvent.setup()
    renderBoundary(<CrashingForm />)

    await user.click(screen.getByRole('button', { name: 'Crash' }))
    await user.click(screen.getByRole('button', { name: 'Try Again' }))
    await user.click(screen.getByRole('button', { name: 'Crash' }))

    expect(screen.getByRole('alert')).toHaveTextContent(retriedMessage)
  })

  it('reloads the failed content\'s data on retry and keeps data still in use', async () => {
    const user = userEvent.setup()
    const loadPage = vi.fn()
      .mockResolvedValueOnce({ broken: true })
      .mockResolvedValue({ broken: false })
    const loadShell = vi.fn().mockResolvedValue('shell')

    function DataPage() {
      const { data } = useQuery({ queryKey: ['page'], queryFn: loadPage, staleTime: Infinity })
      if (data?.broken) throw new Error(marker)
      return <p>{data ? 'Loaded Data' : 'Loading'}</p>
    }
    function Shell() {
      const { data } = useQuery({ queryKey: ['shell'], queryFn: loadShell, staleTime: Infinity })
      return (
        <>
          <p>{data}</p>
          <PageErrorBoundary><DataPage /></PageErrorBoundary>
        </>
      )
    }
    render(
      <QueryClientProvider client={new QueryClient()}><Shell /></QueryClientProvider>,
      renderOptions,
    )

    await user.click(await screen.findByRole('button', { name: 'Try Again' }))

    expect(await screen.findByText('Loaded Data')).toBeInTheDocument()
    expect(loadPage).toHaveBeenCalledTimes(2)
    expect(loadShell).toHaveBeenCalledTimes(1)
    expect(screen.getByText('shell')).toBeInTheDocument()
  })
})
