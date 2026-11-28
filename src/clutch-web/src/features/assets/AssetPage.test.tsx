import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { getCurrencies } from '@/features/accounts/api'
import { acquireEdit, createAsset, endOtherEdit, getEditStatus, releaseEdit, saveAsset } from './api'
import {
  AssetPage, BLOCKED_MESSAGE, CHECK_FAILED_MESSAGE, END_FAILED_MESSAGE, GONE_MESSAGE,
  OPEN_FAILED_MESSAGE, SAVE_FAILED_MESSAGE,
} from './AssetPage'
import {
  assetId, blockedBy, currencies, detail, editId, free, holding, lease, money, otherEditId,
  refusal, renderAssets, watching,
} from './testSupport'

vi.mock('@/features/accounts/api', () => ({ getCurrencies: vi.fn() }))
vi.mock('./api', async (importActual) => ({
  ...await importActual<typeof import('./api')>(),
  acquireEdit: vi.fn(),
  createAsset: vi.fn(),
  endOtherEdit: vi.fn(),
  getEditStatus: vi.fn(),
  releaseEdit: vi.fn(),
  saveAsset: vi.fn(),
}))

const onExit = vi.fn()

/** Stands in for the app: a way to navigate away, and the list the page returns to. */
function Host({ id }: { id?: string }) {
  const [open, setOpen] = useState(true)
  const { run, isDirty } = useUnsavedChanges()
  const exit = () => {
    onExit()
    setOpen(false)
  }
  return (
    <>
      <button onClick={() => run(exit)} type="button">Other Page</button>
      <span data-testid="dirty">{String(isDirty)}</span>
      {open ? <AssetPage assetId={id} onExit={exit} /> : <h1>Assets List</h1>}
    </>
  )
}

const setup = () => userEvent.setup({ delay: null })
const field = (name: string) => screen.getByLabelText(name)
const button = (name: string) => screen.getByRole('button', { name })
const save = () => button('Save')
const onList = () => screen.findByRole('heading', { name: 'Assets List' })
const dirty = () => screen.getByTestId('dirty').textContent
const conflict = () => refusal(409, 'AssetEditActive', { editStatus: blockedBy(otherEditId) })

beforeEach(() => {
  vi.resetAllMocks()
  focusManager.setFocused(true)
  onlineManager.setOnline(true)
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  vi.mocked(releaseEdit).mockResolvedValue(undefined)
  vi.mocked(getEditStatus).mockImplementation(async (_id, watched) => (watched ? holding : blockedBy(otherEditId)))
})

afterEach(() => {
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

describe('adding an asset', () => {
  async function render() {
    const view = renderAssets(<Host />)
    await screen.findByLabelText('Name')
    return view
  }

  async function addValuation(user: ReturnType<typeof setup>, value = '100', date = '2026-01-01') {
    await user.click(button('Add Valuation'))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Value'), value)
    await user.type(within(dialog).getByLabelText('Valuation Date'), date)
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
  }

  async function complete(user: ReturnType<typeof setup>) {
    await user.type(field('Name'), 'Car')
    await user.selectOptions(field('Currency'), 'AUD')
    await addValuation(user)
  }

  it('takes no lease and never checks edit status', async () => {
    await render()

    expect(screen.getByRole('heading', { name: 'Add Asset' })).toBeInTheDocument()
    expect(acquireEdit).not.toHaveBeenCalled()
    expect(getEditStatus).not.toHaveBeenCalled()
  })

  it('lists the supported currencies and waits for one before adding valuations', async () => {
    const user = setup()
    await render()

    expect(within(field('Currency')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Select a currency', 'Australian Dollar (AUD)', 'Japanese Yen (JPY)', 'US Dollar (USD)',
    ])
    expect(button('Add Valuation')).toBeDisabled()

    await user.selectOptions(field('Currency'), 'JPY')

    expect(button('Add Valuation')).toBeEnabled()
  })

  it('shows every missing field and sends nothing', async () => {
    const user = setup()
    await render()

    await user.click(save())

    expect(field('Name')).toHaveAccessibleDescription('Enter a name')
    expect(field('Currency')).toHaveAccessibleDescription('Select a currency')
    expect(screen.getByText('Add at least one valuation')).toBeInTheDocument()
    expect(createAsset).not.toHaveBeenCalled()
  })

  it('limits the name length, clearing the error once it is changed', async () => {
    const user = setup()
    await render()
    await user.click(field('Name'))
    await user.paste('n'.repeat(101))

    await user.click(save())
    expect(field('Name')).toHaveAccessibleDescription('Enter a name of up to 100 characters')

    await user.type(field('Name'), '{Backspace}')
    expect(field('Name')).not.toHaveAccessibleDescription()
  })

  it('limits the description length', async () => {
    const user = setup()
    await render()
    await user.click(field('Description'))
    await user.paste('d'.repeat(501))

    await user.click(save())

    expect(field('Description')).toHaveAccessibleDescription('Enter a description of up to 500 characters')
  })

  it('adds valuations to the draft only, newest first and right aligned', async () => {
    const user = setup()
    await render()
    await complete(user)
    await addValuation(user, '200', '2026-02-01')

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('1 Feb 2026')
    expect(rows[1]).toHaveTextContent(money(100, 'AUD'))
    expect(screen.getByRole('columnheader', { name: 'Value' })).toHaveClass('text-right')
    expect(within(rows[0]!).getAllByRole('cell')[0]).toHaveClass('text-right', 'tabular-nums')
    expect(createAsset).not.toHaveBeenCalled()
  })

  it('says what to do while there are no valuations, with no table', async () => {
    await render()

    expect(screen.getByText('No valuations yet. Add a valuation to record what this asset is worth.'))
      .toHaveClass('text-fg-secondary')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Valuations' })?.tagName).toBe('SECTION')
  })

  it('lists valuations in a card that stops while its rows scroll under a held header', async () => {
    const user = setup()
    await render()
    const add = button('Add Valuation')
    await complete(user)

    const table = screen.getByRole('table', { name: 'Valuations of this asset, newest first' })
    const region = table.closest('[role="region"][aria-label="Valuations"]')!
    const card = region.closest('[data-slot="card"]')!
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('overflow-x-auto', 'overflow-y-hidden')
    expect(card).toHaveClass('sticky', 'top-0')
    expect(card).toContainElement(screen.getByRole('heading', { name: 'Valuations' }))
    expect(region).not.toContainElement(button('Add Valuation'))
    expect(table.querySelector('thead')).toHaveClass('sticky', 'top-0', 'z-10', 'bg-raised')
    expect(table.querySelector('tbody')).toHaveClass('isolate')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Value', 'Valuation Date', 'Actions'])
    // The same button throughout, so focus can return to it.
    expect(button('Add Valuation')).toBe(add)

    await user.click(button('Delete valuation dated 1 Jan 2026'))

    expect(button('Add Valuation')).toBe(add)
    await waitFor(() => expect(add).toHaveFocus())
  })

  it('saves the asset, returns to the list and confirms', async () => {
    vi.mocked(createAsset).mockResolvedValue({ ...detail, name: 'Car' })
    const user = setup()
    await render()
    await complete(user)
    expect(dirty()).toBe('true')

    await user.click(save())

    expect(await onList()).toBeInTheDocument()
    expect(createAsset).toHaveBeenCalledWith({
      name: 'Car', description: null, currencyCode: 'AUD',
      valuations: [{ value: 100, valuationDate: '2026-01-01' }],
    }, expect.anything())
    expect(await screen.findByText('Car was saved.')).toBeInTheDocument()
    expect(dirty()).toBe('false')
  })

  it('shows Save as pending at once and disables the fields', async () => {
    vi.mocked(createAsset).mockReturnValue(new Promise(() => {}))
    const user = setup()
    await render()
    await complete(user)

    await user.click(save())

    expect(button('Saving…')).toBeDisabled()
    expect(field('Name')).toBeDisabled()
    expect(button('Cancel')).toBeDisabled()
  })

  it('shows server field errors on their fields and rows', async () => {
    vi.mocked(createAsset).mockRejectedValue(refusal(400, undefined, {
      errors: { name: ['Name refused'], 'valuations[0].valuationDate': ['Date refused'] },
    }))
    const user = setup()
    await render()
    await complete(user)

    await user.click(save())

    await waitFor(() => expect(field('Name')).toHaveAccessibleDescription('Name refused'))
    expect(within(screen.getByRole('table')).getByText('Date refused')).toBeInTheDocument()
  })

  it.each([['a network error', new TypeError('offline')], ['a server error', refusal(500)]])(
    'keeps the draft after %s',
    async (_label, error) => {
      vi.mocked(createAsset).mockRejectedValue(error)
      const user = setup()
      await render()
      await complete(user)

      await user.click(save())

      expect(await screen.findByText(SAVE_FAILED_MESSAGE)).toBeInTheDocument()
      expect(field('Name')).toHaveValue('Car')
      expect(dirty()).toBe('true')
      expect(save()).toBeEnabled()
    },
  )

  it.each(['Other Page', 'Cancel'])('asks before %s discards unsaved edits', async (leave) => {
    const user = setup()
    await render()
    await user.type(field('Name'), 'Car')

    await user.click(button(leave))
    const prompt = await screen.findByRole('dialog')
    await user.click(within(prompt).getByRole('button', { name: 'Stay on This Page' }))
    expect(field('Name')).toHaveValue('Car')

    await user.click(button(leave))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard Changes' }))
    expect(await onList()).toBeInTheDocument()
    expect(createAsset).not.toHaveBeenCalled()
  })

  it('reformats every value when the currency is changed before the first Save', async () => {
    const user = setup()
    await render()
    await user.selectOptions(field('Currency'), 'AUD')
    await addValuation(user, '12000')

    await user.selectOptions(field('Currency'), 'USD')
    expect(screen.getByRole('table')).toHaveTextContent(money(12000, 'USD'))

    await user.selectOptions(field('Currency'), 'JPY')
    expect(screen.getByRole('table')).toHaveTextContent(money(12000, 'JPY'))
  })

  it('flags each valuation with decimals after a change to yen and blocks Save', async () => {
    const user = setup()
    await render()
    await user.type(field('Name'), 'Car')
    await user.selectOptions(field('Currency'), 'AUD')
    await addValuation(user, '10.5')

    await user.selectOptions(field('Currency'), 'JPY')

    // A value yen cannot hold is shown as entered, never rounded.
    expect(screen.getByRole('table')).toHaveTextContent('10.5')
    expect(screen.getByText('JPY values have no decimal places')).toBeInTheDocument()
    await user.click(save())
    expect(createAsset).not.toHaveBeenCalled()
    await user.click(button('Delete valuation dated 1 Jan 2026'))
    expect(screen.queryByText('JPY values have no decimal places')).not.toBeInTheDocument()
  })
})

describe('editing an asset', () => {
  beforeEach(() => {
    vi.mocked(acquireEdit).mockResolvedValue(lease())
  })

  async function open() {
    const view = renderAssets(<Host id={assetId} />)
    await screen.findByLabelText('Name')
    return view
  }

  async function change(user: ReturnType<typeof setup>) {
    await user.type(field('Name'), ' updated')
  }

  it('shows a loading indicator and no fields while the asset opens', () => {
    vi.mocked(acquireEdit).mockReturnValue(new Promise(() => {}))

    renderAssets(<Host id={assetId} />)

    expect(screen.getByRole('heading', { name: 'Edit Asset' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('loads the asset with its currency and valuations, clean', async () => {
    await open()

    expect(field('Name')).toHaveValue('House')
    expect(field('Description')).toHaveValue('Family home')
    expect(screen.getByText('Currency: Australian Dollar (AUD)')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent(money(12000, 'AUD'))
    expect(rows[1]).toHaveTextContent(money(10000.5, 'AUD'))
    expect(within(rows[0]!).getAllByRole('cell')[0]).toHaveClass('text-right', 'tabular-nums')
    expect(screen.getByRole('columnheader', { name: 'Value' })).toHaveClass('text-right')
    expect(dirty()).toBe('false')
    expect(acquireEdit).toHaveBeenCalledTimes(1)
  })

  it('offers no way to change the currency of a saved asset', async () => {
    await open()

    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(button('Add Valuation')).toBeEnabled()
  })

  it('saves the full set with kept ids, returns to the list without releasing', async () => {
    vi.mocked(saveAsset).mockResolvedValue({ ...detail, name: 'House updated' })
    const user = setup()
    await open()
    await change(user)
    await user.click(button('Delete valuation dated 1 Jan 2025'))

    await user.click(save())

    expect(await onList()).toBeInTheDocument()
    expect(saveAsset).toHaveBeenCalledWith(assetId, editId, {
      name: 'House updated', description: 'Family home', currencyCode: 'AUD',
      valuations: [{ id: detail.valuations[0]!.id, value: 12000, valuationDate: '2026-01-01' }],
    })
    expect(await screen.findByText('House updated was saved.')).toBeInTheDocument()
    expect(releaseEdit).not.toHaveBeenCalled()
  })

  it('asks for a valuation after the last one is deleted, sending nothing', async () => {
    const user = setup()
    await open()

    await user.click(button('Delete valuation dated 1 Jan 2025'))
    await user.click(button('Delete valuation dated 1 Jan 2026'))
    await user.click(save())

    expect(screen.getByText('Add at least one valuation')).toBeInTheDocument()
    expect(saveAsset).not.toHaveBeenCalled()
  })

  it('offers a retry when opening fails, holding and releasing nothing', async () => {
    vi.mocked(acquireEdit).mockRejectedValueOnce(refusal(500)).mockResolvedValue(lease())
    const user = setup()
    renderAssets(<Host id={assetId} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(OPEN_FAILED_MESSAGE)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(button('Return To Assets')).toBeEnabled()
    expect(releaseEdit).not.toHaveBeenCalled()

    await user.click(button('Retry'))
    expect(await screen.findByLabelText('Name')).toHaveValue('House')
  })

  it('returns to the list when the asset no longer exists, releasing nothing', async () => {
    vi.mocked(acquireEdit).mockRejectedValue(refusal(404, 'AssetNotFound'))
    renderAssets(<Host id={assetId} />)

    expect(await onList()).toBeInTheDocument()
    expect(await screen.findByText(GONE_MESSAGE)).toBeInTheDocument()
    expect(releaseEdit).not.toHaveBeenCalled()
  })

  it('releases the edit when the user leaves a clean asset', async () => {
    const user = setup()
    await open()

    await user.click(button('Cancel'))

    await waitFor(() => expect(releaseEdit).toHaveBeenCalledWith(assetId, editId))
    expect(releaseEdit).toHaveBeenCalledTimes(1)
  })

  it('asks before leaving unsaved edits, releasing only once discarded', async () => {
    const user = setup()
    await open()
    await change(user)

    await user.click(button('Other Page'))
    const prompt = await screen.findByRole('dialog')
    expect(releaseEdit).not.toHaveBeenCalled()
    await user.click(within(prompt).getByRole('button', { name: 'Discard Changes' }))

    await waitFor(() => expect(releaseEdit).toHaveBeenCalledWith(assetId, editId))
  })

  it('releases an edit that arrives after the user has left', async () => {
    let arrive: (value: ReturnType<typeof lease>) => void = () => {}
    vi.mocked(acquireEdit).mockReturnValue(new Promise((resolve) => { arrive = resolve }))
    const user = setup()
    renderAssets(<Host id={assetId} />)

    await user.click(button('Other Page'))
    await act(async () => arrive(lease()))

    expect(releaseEdit).toHaveBeenCalledWith(assetId, editId)
  })

  it('sends the release with keepalive as the page unloads', async () => {
    await open()

    act(() => { window.dispatchEvent(new Event('pagehide')) })

    expect(releaseEdit).toHaveBeenCalledWith(assetId, editId, { keepalive: true })
  })

  it('shows the blocking notice naming who ended the edit, and keeps it', async () => {
    vi.mocked(getEditStatus).mockResolvedValue(watching({
      id: editId, state: 'Ended', endedAtUtc: '2026-11-27T12:01:00Z',
      endedBy: { userId: 'u', userName: 'owner@example.test' },
    }))
    const user = setup()
    renderAssets(<Host id={assetId} />)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('owner@example.test')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Return To Assets' }))

    expect(await onList()).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(releaseEdit).not.toHaveBeenCalled()
  })

  it('leaves an expired edit with a persistent message and releases it', async () => {
    vi.mocked(acquireEdit).mockResolvedValue(lease(0.3))
    const user = setup()
    await open()
    await change(user)

    expect(await onList()).toBeInTheDocument()

    const stack = screen.getByRole('region', { name: 'Persistent notifications' })
    expect(await within(stack).findByRole('status')).toHaveTextContent('Your edit of House expired.')
    await waitFor(() => expect(releaseEdit).toHaveBeenCalledWith(assetId, editId))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(dirty()).toBe('false')
  })

  it('treats an Expired status the same way', async () => {
    vi.mocked(getEditStatus).mockResolvedValue(watching({ id: editId, state: 'Expired' }))
    renderAssets(<Host id={assetId} />)

    expect(await onList()).toBeInTheDocument()
    expect(await screen.findByText('Your edit of House expired.')).toBeInTheDocument()
  })

  it.each(['Saved', 'Released', 'Unavailable'] as const)(
    'returns to the list, naming nobody, when the held edit is %s',
    async (state) => {
      vi.mocked(getEditStatus).mockResolvedValue(watching({ id: editId, state }))
      renderAssets(<Host id={assetId} />)

      expect(await onList()).toBeInTheDocument()
      expect(await screen.findByText('Your edit of House is no longer active.')).toBeInTheDocument()
      expect(releaseEdit).not.toHaveBeenCalled()
    },
  )

  async function saveRefusedWith(error: unknown) {
    vi.mocked(saveAsset).mockRejectedValue(error)
    const user = setup()
    await open()
    await change(user)
    await user.click(save())
    return user
  }

  it('returns without a prompt when Save finds the asset gone', async () => {
    await saveRefusedWith(refusal(404, 'AssetNotFound'))

    expect(await onList()).toBeInTheDocument()
    expect(await screen.findByText(GONE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('follows the expired flow when Save is refused as expired', async () => {
    await saveRefusedWith(refusal(409, 'AssetEditExpired'))

    expect(await onList()).toBeInTheDocument()
    expect(await screen.findByText('Your edit of House expired.')).toBeInTheDocument()
    await waitFor(() => expect(releaseEdit).toHaveBeenCalledWith(assetId, editId))
  })

  it('names who ended the edit when Save is refused as ended', async () => {
    let ended = false
    vi.mocked(getEditStatus).mockImplementation(async () => (ended
      ? watching({
        id: editId, state: 'Ended', endedAtUtc: '2026-11-27T12:01:00Z',
        endedBy: { userId: 'u', userName: 'owner@example.test' },
      })
      : holding))
    vi.mocked(saveAsset).mockImplementation(async () => {
      ended = true
      throw refusal(409, 'AssetEditEnded')
    })
    const user = setup()
    await open()
    await change(user)

    await user.click(save())

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('owner@example.test')
    expect(screen.queryByText(SAVE_FAILED_MESSAGE)).not.toBeInTheDocument()
  })

  it('returns without a prompt when Save is refused as changed', async () => {
    await saveRefusedWith(refusal(409, 'AssetEditChanged'))

    expect(await onList()).toBeInTheDocument()
    expect(await screen.findByText('Your edit of House is no longer active.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(releaseEdit).not.toHaveBeenCalled()
  })

  it.each([['a network error', new TypeError('offline')], ['a server error', refusal(500)]])(
    'keeps the edits when Save fails with %s',
    async (_label, error) => {
      await saveRefusedWith(error)

      expect(await screen.findByText(SAVE_FAILED_MESSAGE)).toBeInTheDocument()
      expect(field('Name')).toHaveValue('House updated')
      expect(dirty()).toBe('true')
    },
  )

  it('keeps editing enabled when a status check fails, and offers a retry', async () => {
    vi.mocked(getEditStatus).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(holding)
    const user = setup()
    await open()

    expect(await screen.findByText(CHECK_FAILED_MESSAGE)).toBeInTheDocument()
    expect(field('Name')).toBeEnabled()

    await user.click(button('Retry Availability Check'))

    await waitFor(() => expect(screen.queryByText(CHECK_FAILED_MESSAGE)).not.toBeInTheDocument())
  })

  it('keeps editing disabled after a return to the page until a check succeeds', async () => {
    await open()
    await waitFor(() => expect(getEditStatus).toHaveBeenCalled())
    act(() => focusManager.setFocused(false))
    vi.mocked(getEditStatus).mockRejectedValue(new TypeError('offline'))

    act(() => focusManager.setFocused(true))

    expect(await screen.findByText(CHECK_FAILED_MESSAGE)).toBeInTheDocument()
    expect(field('Name')).toBeDisabled()
    expect(save()).toBeDisabled()

    vi.mocked(getEditStatus).mockResolvedValue(holding)
    await userEvent.setup().click(button('Retry Availability Check'))

    await waitFor(() => expect(field('Name')).toBeEnabled())
  })
})

describe('a blocked asset', () => {
  beforeEach(() => {
    vi.mocked(acquireEdit).mockRejectedValue(conflict())
  })

  async function open() {
    renderAssets(<Host id={assetId} />)
    await screen.findByText(BLOCKED_MESSAGE)
    return setup()
  }

  it('says so, offers to end the other edit and shows no fields', async () => {
    await open()

    expect(button('End Other Edit')).toBeEnabled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(releaseEdit).not.toHaveBeenCalled()
  })

  it('ends exactly the active edit, showing pending at once', async () => {
    vi.mocked(endOtherEdit).mockReturnValue(new Promise(() => {}))
    const user = await open()

    await user.click(button('End Other Edit'))

    expect(endOtherEdit).toHaveBeenCalledWith(assetId, otherEditId)
    expect(button('Ending Other Edit…')).toBeDisabled()
  })

  it('takes the edit once no edit is active', async () => {
    const user = await open()
    vi.mocked(endOtherEdit).mockResolvedValue(undefined)
    vi.mocked(getEditStatus).mockImplementation(async (_id, watched) => (watched ? holding : free))
    vi.mocked(acquireEdit).mockResolvedValue(lease())

    await user.click(button('End Other Edit'))

    expect(await screen.findByLabelText('Name')).toHaveValue('House')
    expect(acquireEdit).toHaveBeenCalledTimes(2)
  })

  it('targets the newer edit after a refused end, with no error message', async () => {
    const newer = '550e8400-e29b-41d4-a716-446655440004'
    const user = await open()
    vi.mocked(endOtherEdit).mockImplementation(async () => {
      vi.mocked(getEditStatus).mockResolvedValue(blockedBy(newer))
      throw refusal(409, 'AssetEditChanged')
    })

    await user.click(button('End Other Edit'))
    await waitFor(() => expect(button('End Other Edit')).toBeEnabled())
    await waitFor(() => expect(getEditStatus).toHaveBeenCalledTimes(2))
    await user.click(button('End Other Edit'))

    expect(endOtherEdit).toHaveBeenLastCalledWith(assetId, newer)
    expect(screen.queryByText(END_FAILED_MESSAGE)).not.toBeInTheDocument()
  })

  it('takes the edit after a refused end when none is active', async () => {
    const user = await open()
    vi.mocked(acquireEdit).mockResolvedValue(lease())
    vi.mocked(endOtherEdit).mockImplementation(async () => {
      vi.mocked(getEditStatus).mockImplementation(async (_id, watched) => (watched ? holding : free))
      throw refusal(409, 'AssetEditChanged')
    })

    await user.click(button('End Other Edit'))

    expect(await screen.findByLabelText('Name')).toBeInTheDocument()
    expect(screen.queryByText(END_FAILED_MESSAGE)).not.toBeInTheDocument()
  })

  it.each([['a network error', new TypeError('offline')], ['a server error', refusal(500)]])(
    'stays blocked when ending fails with %s',
    async (_label, error) => {
      vi.mocked(endOtherEdit).mockRejectedValue(error)
      const user = await open()

      await user.click(button('End Other Edit'))

      expect(await screen.findByText(END_FAILED_MESSAGE)).toBeInTheDocument()
      expect(screen.getByText(BLOCKED_MESSAGE)).toBeInTheDocument()
      expect(button('End Other Edit')).toBeEnabled()
    },
  )

  it('stays blocked and never opens when a check fails', async () => {
    vi.mocked(getEditStatus).mockRejectedValue(new TypeError('offline'))
    await open()

    expect(await screen.findByText(CHECK_FAILED_MESSAGE)).toBeInTheDocument()
    expect(button('Retry Availability Check')).toBeInTheDocument()
    expect(button('End Other Edit')).toBeEnabled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(acquireEdit).toHaveBeenCalledTimes(1)
  })

  it('returns to the list if the asset has gone', async () => {
    vi.mocked(getEditStatus).mockRejectedValue(refusal(404))
    renderAssets(<Host id={assetId} />)

    expect(await onList()).toBeInTheDocument()
    expect(await screen.findByText(GONE_MESSAGE)).toBeInTheDocument()
  })
})
