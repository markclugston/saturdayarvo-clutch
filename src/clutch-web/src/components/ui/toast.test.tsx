import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './toast'

function Trigger() {
  const { show, showPersistent, clearPersistent } = useToast()
  return (
    <>
      <button onClick={() => show('Mortgage saved')} type="button">Show</button>
      <button onClick={() => showPersistent('Your edit of House expired.')} type="button">Persist</button>
      <button onClick={clearPersistent} type="button">Clear</button>
    </>
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ToastProvider><Trigger /></ToastProvider>)
    return user
  }

  async function open() {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Show' }))
    return user
  }

  const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

  it('shows the message in a status region with a Dismiss button', async () => {
    await open()

    expect(await screen.findByRole('status')).toHaveTextContent('Mortgage saved')
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('closes after 5 seconds', async () => {
    await open()
    await screen.findByRole('status')

    await wait(5500)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stays open while hovered and closes after the pointer leaves', async () => {
    const user = await open()
    const toast = await screen.findByRole('status')

    await user.hover(toast)
    await wait(8000)
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.unhover(toast)
    await wait(5500)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('closes when Dismiss is pressed', async () => {
    const user = await open()

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))
    await wait(500)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('persistent', () => {
    const regularStack = () => screen.getByRole('region', { name: 'Notifications' })
    const persistentStack = () => screen.getByRole('region', { name: 'Persistent notifications' })

    it('has no timeout and sits in its own stack', async () => {
      const user = setup()
      await user.click(screen.getByRole('button', { name: 'Persist' }))

      await wait(120_000)

      expect(within(persistentStack()).getByRole('status'))
        .toHaveTextContent('Your edit of House expired.')
      expect(within(regularStack()).queryByRole('status')).not.toBeInTheDocument()
    })

    it('closes only through Dismiss, not Escape', async () => {
      const user = setup()
      await user.click(screen.getByRole('button', { name: 'Persist' }))
      const toast = await within(persistentStack()).findByRole('status')

      act(() => toast.focus())
      await user.keyboard('{Escape}')
      await wait(1000)
      expect(within(persistentStack()).getByRole('status')).toBeInTheDocument()

      await user.click(within(persistentStack()).getByRole('button', { name: 'Dismiss' }))
      await wait(1000)
      expect(within(persistentStack()).queryByRole('status')).not.toBeInTheDocument()
    })

    it('stays below regular toasts, which never replace, hide or push it out', async () => {
      const user = setup()
      await user.click(screen.getByRole('button', { name: 'Persist' }))
      for (let count = 0; count < 5; count += 1) {
        await user.click(screen.getByRole('button', { name: 'Show' }))
      }

      expect(regularStack().compareDocumentPosition(persistentStack()))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(regularStack().parentElement).toBe(persistentStack().parentElement)
      const toast = within(persistentStack()).getByRole('status')
      expect(toast).not.toHaveAttribute('data-limited')
      expect(toast).not.toHaveAttribute('inert')

      await wait(10_000)
      expect(within(persistentStack()).getByRole('status')).toBe(toast)
    })

    it('keeps every persistent toast, however many there are', async () => {
      const user = setup()
      for (let count = 0; count < 5; count += 1) {
        await user.click(screen.getByRole('button', { name: 'Persist' }))
      }

      const toasts = within(persistentStack()).getAllByRole('status')
      expect(toasts).toHaveLength(5)
      for (const toast of toasts) {
        expect(toast).not.toHaveAttribute('data-limited')
      }
    })

    it('can be cleared together, as at the end of a sign-in', async () => {
      const user = setup()
      await user.click(screen.getByRole('button', { name: 'Persist' }))
      await user.click(screen.getByRole('button', { name: 'Show' }))

      await user.click(screen.getByRole('button', { name: 'Clear' }))
      await wait(1000)

      expect(within(persistentStack()).queryByRole('status')).not.toBeInTheDocument()
      expect(within(regularStack()).getByRole('status')).toBeInTheDocument()
    })
  })
})
