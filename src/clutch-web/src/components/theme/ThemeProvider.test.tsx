import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider'

function ThemeControls() {
  const { mode, setMode } = useTheme()

  return (
    <div>
      <p role="status">{mode}</p>
      <button onClick={() => setMode('Light')}>Light</button>
      <button onClick={() => setMode('Dark')}>Dark</button>
      <button onClick={() => setMode('System')}>System</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  let matchesDark: boolean
  let mediaQueryListeners: Set<EventListenerOrEventListenerObject>
  let mediaQuery: {
    matches: boolean
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    matchesDark = false
    mediaQueryListeners = new Set()
    mediaQuery = {
      get matches() {
        return matchesDark
      },
      addEventListener: vi.fn((
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        mediaQueryListeners.add(listener)
      }),
      removeEventListener: vi.fn((
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        mediaQueryListeners.delete(listener)
      }),
    }
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery))
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to Light regardless of the operating system preference', async () => {
    matchesDark = true
    render(<ThemeProvider><ThemeControls /></ThemeProvider>)

    expect(screen.getByRole('status')).toHaveTextContent('Light')
    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass('dark')
    }, { timeout: 500 })
  })

  it.each([
    { mode: 'Dark', dark: true },
    { mode: 'Light', dark: false },
  ] as const)('applies $mode without a reload', async ({ mode, dark }) => {
    render(<ThemeProvider><ThemeControls /></ThemeProvider>)

    fireEvent.click(screen.getByRole('button', { name: mode }))

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(dark)
    }, { timeout: 500 })
  })

  it('uses the current operating system preference when System is selected', async () => {
    matchesDark = true
    render(<ThemeProvider><ThemeControls /></ThemeProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'System' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('System')
      expect(document.documentElement).toHaveClass('dark')
    }, { timeout: 500 })
  })

  it('uses Light when the operating system preference is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    render(<ThemeProvider><ThemeControls /></ThemeProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')

    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('tracks both system transitions only in System mode and removes its listener', async () => {
    const { unmount } = render(<ThemeProvider><ThemeControls /></ThemeProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(mediaQuery.addEventListener).toHaveBeenCalledTimes(1)

    matchesDark = true
    dispatchMediaChange()
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'), { timeout: 1000 })

    matchesDark = false
    dispatchMediaChange()
    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass('dark')
    }, { timeout: 1000 })

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(mediaQuery.removeEventListener).toHaveBeenCalledTimes(1)
    matchesDark = false
    dispatchMediaChange()
    expect(document.documentElement).toHaveClass('dark')

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    matchesDark = true
    dispatchMediaChange()
    expect(document.documentElement).not.toHaveClass('dark')

    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(mediaQuery.addEventListener).toHaveBeenCalledTimes(2)
    unmount()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledTimes(2)
  })

  function dispatchMediaChange() {
    const event = new Event('change')
    for (const listener of mediaQueryListeners) {
      if (typeof listener === 'function') {
        listener(event)
      } else {
        listener.handleEvent(event)
      }
    }
  }
})
