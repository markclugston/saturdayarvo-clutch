import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetEditEndedDialog } from './AssetEditEndedDialog'

describe('AssetEditEndedDialog', () => {
  function open() {
    const onAcknowledge = vi.fn()
    render(<AssetEditEndedDialog onAcknowledge={onAcknowledge} userName="owner@example.test" />)
    return { onAcknowledge, user: userEvent.setup() }
  }

  it('names who ended the edit and focuses its one button', async () => {
    open()

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Edit Ended')
    expect(dialog).toHaveTextContent('ended by owner@example.test in another session')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Return To Assets' })).toHaveFocus())
  })

  it('cannot be dismissed with Escape or an outside press', async () => {
    const { onAcknowledge, user } = open()

    await user.keyboard('{Escape}')
    await user.click(document.body)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onAcknowledge).not.toHaveBeenCalled()
  })

  it('returns to the assets', async () => {
    const { onAcknowledge, user } = open()

    await user.click(screen.getByRole('button', { name: 'Return To Assets' }))

    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })
})
