import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeleteDialog } from './delete-dialog'

function setup(props: Partial<Parameters<typeof DeleteDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <DeleteDialog
      busy={false}
      description="This permanently deletes “Car”. This cannot be undone."
      gone={false}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Thing"
      {...props}
    />,
  )
  return { onConfirm, onClose, user: userEvent.setup() }
}

describe('DeleteDialog', () => {
  it('asks for confirmation with focus on Cancel', async () => {
    const { onConfirm, onClose, user } = setup()

    expect(screen.getByRole('alertdialog', { name: 'Delete Thing' }))
      .toHaveAccessibleDescription('This permanently deletes “Car”. This cannot be undone.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const { onClose, user } = setup()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows progress and cannot be dismissed while deleting', async () => {
    const { onClose, user } = setup({ busy: true })

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a failure inside the dialog', () => {
    setup({ message: 'It could not be deleted.' })

    expect(screen.getByRole('alert')).toHaveTextContent('It could not be deleted.')
    expect(screen.getByRole('alertdialog')).toContainElement(screen.getByRole('alert'))
  })

  it('offers only Close for an item that is already gone', () => {
    setup({ gone: true, message: 'This thing no longer exists.' })

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
  })
})
