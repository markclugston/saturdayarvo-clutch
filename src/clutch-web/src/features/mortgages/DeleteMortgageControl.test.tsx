import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import type { Mortgage } from '@/lib/api/schemas'
import { DeleteMortgageControl } from './DeleteMortgageControl'
import { conflictError, installFakeApi, makeMortgage, problem, type FakeServer } from './testSupport'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
}))

function Dirty({ dirty }: { dirty: boolean }) {
  const { setDirty } = useUnsavedChanges()
  useEffect(() => setDirty(dirty), [dirty, setDirty])
  return null
}

type HarnessProps = {
  mortgage: Mortgage
  dirty?: boolean
  onDeleted?: (id: string) => void
  onGone?: (id: string) => void
  onReload?: () => Promise<void>
}

function Harness({ mortgage, dirty = false, ...handlers }: HarnessProps) {
  return (
    <UnsavedChangesProvider>
      <Dirty dirty={dirty} />
      <DeleteMortgageControl
        mortgage={mortgage}
        onDeleted={handlers.onDeleted ?? (() => {})}
        onGone={handlers.onGone ?? (() => {})}
        onReload={handlers.onReload ?? (async () => {})}
        onUnauthorized={() => {}}
      />
    </UnsavedChangesProvider>
  )
}

describe('DeleteMortgageControl', () => {
  let server: FakeServer
  const home = makeMortgage({ name: 'Home' })
  const car = makeMortgage({ name: 'Car' })

  beforeEach(() => {
    vi.resetAllMocks()
    server = installFakeApi([home, car])
  })

  it('opens "Delete {name}?" with Delete and Cancel; Cancel returns focus to the trash button', async () => {
    const user = userEvent.setup()
    render(<Harness mortgage={home} />)
    const trash = screen.getByRole('button', { name: 'Delete Home' })

    await user.click(trash)
    expect(await screen.findByRole('dialog', { name: 'Delete Home?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trash).toHaveFocus()
  })

  it('confirm shows Deleting… and disables the button at once, then reports the delete', async () => {
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    render(<Harness mortgage={car} onDeleted={onDeleted} />)
    await user.click(screen.getByRole('button', { name: 'Delete Car' }))
    const release = server.hold('DELETE')

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    await act(async () => release())

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(car.id))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a 409 keeps the dialog open with a conflict alert and Reload; a clean Reload shows Reloading… then closes', async () => {
    const onReload = vi.fn(() => new Promise<void>((resolve) => { setTimeout(resolve, 50) }))
    const user = userEvent.setup()
    render(<Harness mortgage={home} onReload={onReload} />)
    server.failNext('DELETE', conflictError())
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This mortgage was changed elsewhere; reload to see the latest')
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(screen.getByRole('button', { name: 'Reloading…' })).toBeDisabled()

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('a failed Reload keeps the dialog open with an alert and Reload enabled again', async () => {
    const onReload = vi.fn().mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<Harness mortgage={home} onReload={onReload} />)
    server.failNext('DELETE', conflictError())
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Reload' }))

    expect(await screen.findByText('The latest version could not be loaded. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('a 404 closes the dialog and reports the mortgage gone', async () => {
    const onGone = vi.fn()
    const user = userEvent.setup()
    render(<Harness mortgage={home} onGone={onGone} />)
    server.failNext('DELETE', problem(404))
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onGone).toHaveBeenCalledWith(home.id))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a 500 or network failure keeps the dialog open with a generic alert and Delete enabled again', async () => {
    const user = userEvent.setup()
    render(<Harness mortgage={home} />)
    server.failNext('DELETE', problem(500))
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The mortgage could not be deleted. Please try again.')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()

    server.failNext('DELETE', new TypeError('network'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be deleted'))
  })

  it('with unsaved changes the selected mortgage opens the dialog without a discard prompt', async () => {
    const user = userEvent.setup()
    render(<Harness dirty mortgage={home} />)

    await user.click(screen.getByRole('button', { name: 'Delete Home' }))

    expect(await screen.findByRole('dialog', { name: 'Delete Home?' })).toBeInTheDocument()
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument()
  })

  it('Reload with unsaved changes asks first; Stay closes the dialog and runs nothing', async () => {
    const onReload = vi.fn(async () => {})
    const user = userEvent.setup()
    render(<Harness dirty mortgage={home} onReload={onReload} />)
    server.failNext('DELETE', conflictError())
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Reload' }))

    await user.click(await screen.findByRole('button', { name: 'Stay on this page' }))

    expect(onReload).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
