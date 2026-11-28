import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrencies } from '@/features/accounts/api'
import { ApiError } from '@/lib/api/client'
import { deleteAsset, listAssets } from './api'
import { AssetsPage, EMPTY_MESSAGE, LOAD_FAILED_MESSAGE } from './AssetsPage'
import { assetId, assetList, currencies, money, renderAssets } from './testSupport'

vi.mock('@/features/accounts/api', () => ({ getCurrencies: vi.fn() }))
vi.mock('./api', async (importActual) => ({
  ...await importActual<typeof import('./api')>(),
  listAssets: vi.fn(),
  deleteAsset: vi.fn(),
}))
// What the hook does with the elements is covered by its own tests.
const pinned = vi.hoisted(() => ({ trackRef: vi.fn(), listRef: vi.fn(), spacerRef: vi.fn() }))
vi.mock('@/lib/usePinnedList', () => ({ usePinnedList: () => pinned }))

describe('AssetsPage', () => {
  const onAdd = vi.fn()
  const onOpen = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCurrencies).mockResolvedValue(currencies)
    vi.mocked(listAssets).mockResolvedValue(assetList)
  })

  const render = () => renderAssets(<AssetsPage onAdd={onAdd} onOpen={onOpen} />)
  const table = () => screen.findByRole('table')
  const rowOf = (name: string) => screen.getByTitle(name).closest('tr')!

  it('shows a loading state at once while the list loads', () => {
    vi.mocked(listAssets).mockReturnValue(new Promise(() => {}))

    render()

    expect(screen.getByRole('status')).toHaveTextContent('Loading assets…')
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Add Asset' })).toBeEnabled()
  })

  it('lists assets in the order returned, each in its own currency', async () => {
    render()
    await table()

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows.slice(1, 4).map((row) => within(row).getAllByRole('cell')[0]!.textContent))
      .toEqual(['House', 'Bond', 'Shares'])
    expect(rowOf('House')).toHaveTextContent(money(12000, 'AUD'))
    expect(rowOf('House')).toHaveTextContent('1 Jan 2026')
    expect(rowOf('Bond')).toHaveTextContent(money(5000, 'JPY'))
    expect(rowOf('Bond')).not.toHaveTextContent('.00')
    expect(rowOf('Shares')).toHaveTextContent(money(2000, 'USD'))
  })

  it('right aligns the valuations, totals and their header', async () => {
    render()
    await table()

    expect(screen.getByRole('columnheader', { name: 'Valuation' })).toHaveClass('text-right')
    for (const row of [rowOf('House'), screen.getByRole('row', { name: /Total AUD/ })]) {
      expect(row.querySelector('td.tabular-nums')).toHaveClass('text-right', 'tabular-nums')
    }
  })

  it('stops its card while the list scrolls, with the column header held in the list', async () => {
    render()
    await table()

    const assetTable = screen.getByRole('table', {
      name: 'Your assets with their latest valuations and totals by currency',
    })
    const header = assetTable.querySelector('thead')!
    const region = assetTable.parentElement!
    const card = region.closest('[data-slot="card"]')!
    const track = card.parentElement!
    const spacer = card.nextElementSibling!
    expect(pinned.trackRef).toHaveBeenCalledWith(track)
    expect(pinned.listRef).toHaveBeenCalledWith(region)
    expect(pinned.spacerRef).toHaveBeenCalledWith(spacer)
    expect(track).toHaveClass('min-w-0', '[overflow-anchor:none]')
    expect(track.firstElementChild).toBe(card)
    expect(card).toHaveClass('sticky', 'top-0')
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(header).toHaveClass('sticky', 'top-0', 'z-10', 'bg-raised')
    expect(assetTable.querySelector('tbody')).toHaveClass('isolate')

    expect(region).toHaveAttribute('role', 'region')
    expect(region).toHaveAccessibleName('Assets')
    expect(region).toHaveClass('relative', 'overflow-x-auto', 'overflow-y-hidden', '[overflow-anchor:none]')
    expect(region).toHaveAttribute('tabindex', '0')

    const headers = within(header).getAllByRole('columnheader')
    expect(headers.map((cell) => cell.textContent)).toEqual(['Name', 'Description', 'Valuation', 'Actions'])
    for (const cell of headers) {
      expect(cell).toHaveAttribute('scope', 'col')
    }
    for (const cell of headers.slice(2)) {
      expect(cell).toHaveClass('text-right')
    }
  })

  it('never holds the totals footer: it scrolls at the end of the list', async () => {
    render()
    await table()

    const assetTable = screen.getByRole('table')
    const footer = assetTable.querySelector('tfoot')!
    expect(assetTable.closest('[role="region"]')).toContainElement(footer)
    expect(footer).toContainElement(screen.getByRole('row', { name: /Total AUD/ }))
    expect(footer).not.toHaveAttribute('class')
    expect(footer).not.toHaveAttribute('style')
  })

  it('truncates long text and keeps it in the title', async () => {
    render()
    await table()

    const description = screen.getByTitle('x'.repeat(300))
    expect(description).toHaveClass('truncate')
    expect(screen.getByTitle('House')).toHaveClass('truncate')
  })

  it('ends with one total row per currency, in the order returned', async () => {
    vi.mocked(listAssets).mockResolvedValue({
      ...assetList,
      totals: [
        { currencyCode: 'AUD', totalValue: '109999999999998900.01' },
        { currencyCode: 'JPY', totalValue: '5000' },
        { currencyCode: 'USD', totalValue: '2000.00' },
      ],
    })

    render()
    await table()

    const totals = screen.getAllByRole('row', { name: /^Total / })
    expect(totals.map((row) => within(row).getByRole('rowheader').textContent))
      .toEqual(['Total AUD', 'Total JPY', 'Total USD'])
    // Far beyond exact number range, and still shown to the cent.
    expect(totals[0]).toHaveTextContent(
      money(109999999999998900n, 'AUD').replace(/\.00$/, '.01'),
    )
    expect(totals[1]).toHaveTextContent(money(5000, 'JPY'))
  })

  it('shows an empty state with no total row', async () => {
    vi.mocked(listAssets).mockResolvedValue({ assets: [], totals: [] })

    render()

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Total /)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Asset' })).toBeEnabled()
  })

  it.each([
    ['the list, with a network error', () => vi.mocked(listAssets).mockRejectedValueOnce(new TypeError('offline'))],
    ['the list, with a 500', () => vi.mocked(listAssets).mockRejectedValueOnce(new ApiError(500, {}))],
    ['the currencies', () => vi.mocked(getCurrencies).mockRejectedValueOnce(new ApiError(500, {}))],
  ])('offers a retry when %s fails, showing no rows', async (_label, fail) => {
    fail()
    const user = userEvent.setup()
    render()

    expect(await screen.findByRole('alert')).toHaveTextContent(LOAD_FAILED_MESSAGE)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Asset' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await table()).toBeInTheDocument()
  })

  it('opens an asset from its quill button, by pointer or keyboard', async () => {
    const user = userEvent.setup()
    render()
    await table()
    const edit = screen.getByRole('button', { name: 'Edit House' })

    await user.click(edit)
    expect(onOpen).toHaveBeenLastCalledWith(assetId)

    edit.focus()
    await user.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('does not open an asset from its row or its name', async () => {
    const user = userEvent.setup()
    render()
    await table()

    await user.click(screen.getByText('Family home'))
    await user.click(screen.getByText('House'))

    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'House' })).not.toBeInTheDocument()
  })

  it('puts the quill button before the delete button', async () => {
    render()
    await table()

    expect(within(rowOf('House')).getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual(['Edit House', 'Delete House'])
  })

  it('starts a new asset', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: 'Add Asset' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('opens the delete dialog from the trash button without opening the asset', async () => {
    const user = userEvent.setup()
    render()
    await table()

    await user.click(screen.getByRole('button', { name: 'Delete House' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Delete Asset')
    expect(dialog).toHaveTextContent('House')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onOpen).not.toHaveBeenCalled()
    expect(deleteAsset).not.toHaveBeenCalled()
  })

  it('reports an asset in an unsupported currency', async () => {
    vi.mocked(getCurrencies).mockResolvedValue([currencies[0]!])

    render()

    expect(await screen.findByRole('alert')).toHaveTextContent('not supported')
  })
})
