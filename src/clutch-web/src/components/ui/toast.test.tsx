import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './toast'

function Trigger() {
  const { show } = useToast()
  return <button onClick={() => show('Mortgage saved')} type="button">Show</button>
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function open() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ToastProvider><Trigger /></ToastProvider>)
    await user.click(screen.getByRole('button', { name: 'Show' }))
    return user
  }

  it('shows the message in a status region with a Dismiss button', async () => {
    await open()

    expect(await screen.findByRole('status')).toHaveTextContent('Mortgage saved')
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('closes after 5 seconds', async () => {
    await open()
    await screen.findByRole('status')

    await act(async () => { await vi.advanceTimersByTimeAsync(5500) })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stays open while hovered and closes after the pointer leaves', async () => {
    const user = await open()
    const toast = await screen.findByRole('status')

    await user.hover(toast)
    await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.unhover(toast)
    await act(async () => { await vi.advanceTimersByTimeAsync(5500) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('closes when Dismiss is pressed', async () => {
    const user = await open()

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
