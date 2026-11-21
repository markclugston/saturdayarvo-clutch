import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChanges } from './UnsavedChangesProvider'

function Harness({ action }: { action: () => void }) {
  const { isDirty, setDirty, run } = useUnsavedChanges()
  return (
    <>
      <p>{isDirty ? 'dirty' : 'clean'}</p>
      <button onClick={() => setDirty(true)} type="button">Edit</button>
      <button onClick={() => run(action)} type="button">Go</button>
    </>
  )
}

function setup() {
  const action = vi.fn()
  const user = userEvent.setup()
  render(<UnsavedChangesProvider><Harness action={action} /></UnsavedChangesProvider>)
  return { action, user }
}

describe('UnsavedChangesProvider', () => {
  it('runs the action at once when clean', async () => {
    const { action, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Go' }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Discard Unsaved Changes?')).not.toBeInTheDocument()
  })

  it('asks before running the action when dirty, and Stay keeps everything', async () => {
    const { action, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))

    expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stay on This Page' }))

    expect(action).not.toHaveBeenCalled()
    expect(screen.getByText('dirty')).toBeInTheDocument()
    expect(screen.queryByText('Discard Unsaved Changes?')).not.toBeInTheDocument()
  })

  it('runs the action and becomes clean on Discard changes', async () => {
    const { action, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))

    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByText('clean')).toBeInTheDocument()
  })

  it('registers beforeunload only while dirty and stores nothing', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { user } = setup()
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Go' }))
    await user.click(await screen.findByRole('button', { name: 'Discard Changes' }))
    expect(remove.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)
    expect(setItem).not.toHaveBeenCalled()
    add.mockRestore()
    remove.mockRestore()
    setItem.mockRestore()
  })
})
