import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DeleteButton, EditButton, ListActionsCell, ListActionsHeader, ListBody, ListCard, ListCell, ListEmpty, ListHead,
  ListHeaderCell, ListLoadError, ListLoading, ListRegion, ListRow, ListTable,
} from './list'

// What the hook does with the elements is covered by its own tests.
const pinned = vi.hoisted(() => ({ trackRef: vi.fn(), listRef: vi.fn(), spacerRef: vi.fn() }))
vi.mock('@/lib/usePinnedList', () => ({ usePinnedList: () => pinned }))

const table = (
  <ListTable caption="Things you own">
    <ListHead>
      <tr>
        <ListHeaderCell>Name</ListHeaderCell>
        <ListHeaderCell numeric>Value</ListHeaderCell>
        <ListActionsHeader />
      </tr>
    </ListHead>
    <ListBody>
      <ListRow>
        <ListCell>Car</ListCell>
        <ListCell numeric>10</ListCell>
        <ListActionsCell>
          <EditButton label="Edit Car" />
          <DeleteButton label="Delete Car" />
        </ListActionsCell>
      </ListRow>
    </ListBody>
  </ListTable>
)

describe('ListCard', () => {
  it('wires the stopped card, its region and spacer to the pinned list hook', () => {
    render(<ListCard label="Things">{table}</ListCard>)

    const region = screen.getByRole('region', { name: 'Things' })
    const card = region.closest('[data-slot="card"]')!
    expect(pinned.trackRef).toHaveBeenCalledWith(card.parentElement)
    expect(pinned.listRef).toHaveBeenCalledWith(region)
    expect(pinned.spacerRef).toHaveBeenCalledWith(card.nextElementSibling)
    expect(card.parentElement).toHaveClass('min-w-0', '[overflow-anchor:none]')
    expect(card).toHaveClass('sticky', 'top-0', 'min-w-0')
    expect(card.nextElementSibling).toHaveAttribute('aria-hidden', 'true')
    expect(region).toHaveClass(
      'relative', 'overflow-x-auto', 'overflow-y-hidden', 'rounded-control', '[overflow-anchor:none]',
      'focus-visible:focus-ring',
    )
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region.firstElementChild).toBe(screen.getByRole('table', { name: 'Things you own' }))
  })

  it('keeps the title above the region, inside the card', () => {
    render(
      <ListCard aria-labelledby="things" as="section" label="Things" title={<h2 id="things">My Things</h2>}>
        {table}
      </ListCard>,
    )

    const card = screen.getByRole('region', { name: 'My Things' })
    const heading = screen.getByRole('heading', { name: 'My Things' })
    expect(card).toContainElement(heading)
    expect(screen.getByRole('region', { name: 'Things' })).not.toContainElement(heading)
    expect(card).toHaveClass('space-y-3')
  })

  it('puts what follows the rows at the end of the region, with room for its focus ring', () => {
    render(<ListCard end={<button type="button">More</button>} label="Things">{table}</ListCard>)

    const region = screen.getByRole('region', { name: 'Things' })
    const more = screen.getByRole('button', { name: 'More' })
    expect(region).toContainElement(more)
    expect(more.parentElement).toHaveClass('sticky', 'left-0', 'w-fit')
    expect(region.firstElementChild).toHaveClass('w-fit', 'min-w-full', 'pb-1')
    expect(region).toHaveClass('-mx-1', '-mb-1', 'px-1')
  })

  it('keeps the table in place, with no extra room, while nothing follows the rows', () => {
    const { rerender } = render(<ListCard end={null} label="Things">{table}</ListCard>)
    const element = screen.getByRole('table')
    expect(screen.getByRole('region', { name: 'Things' })).not.toHaveClass('px-1')
    expect(element.parentElement).not.toHaveClass('pb-1')

    rerender(<ListCard end={<p>Late</p>} label="Things">{table}</ListCard>)

    expect(screen.getByRole('table')).toBe(element)
  })

  it('shows the empty content in place of the region, keeping the same title element', () => {
    const title = <button type="button">Add Thing</button>
    const { rerender } = render(<ListCard empty={<p>Nothing yet.</p>} label="Things" title={title}>{table}</ListCard>)
    const add = screen.getByRole('button', { name: 'Add Thing' })
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    rerender(<ListCard label="Things" title={title}>{table}</ListCard>)

    expect(screen.getByRole('button', { name: 'Add Thing' })).toBe(add)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

describe('ListRegion', () => {
  it('can scroll within itself, for a list that cannot follow the page', () => {
    render(<ListRegion label="Changes" scroll="self">{table}</ListRegion>)

    const region = screen.getByRole('region', { name: 'Changes' })
    expect(region).toHaveClass('overflow-auto', 'focus-visible:focus-ring')
    expect(region).not.toHaveClass('overflow-y-hidden')
    expect(region).toHaveAttribute('tabindex', '0')
  })
})

describe('list table parts', () => {
  it('holds the header, lines the rows and right aligns numbers and actions', () => {
    render(table)

    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((cell) => cell.textContent)).toEqual(['Name', 'Value', 'Actions'])
    headers.forEach((cell) => expect(cell).toHaveAttribute('scope', 'col'))
    expect(headers[0]).not.toHaveClass('text-right')
    expect(headers[1]).toHaveClass('text-right')
    expect(headers[2]).toHaveClass('text-right')
    expect(screen.getByText('Actions')).toHaveClass('sr-only')

    const element = screen.getByRole('table', { name: 'Things you own' })
    expect(element).toHaveClass('w-full', 'text-left', 'text-sm')
    expect(element.querySelector('thead')).toHaveClass('sticky', 'top-0', 'z-10', 'bg-raised')
    expect(element.querySelector('tbody')).toHaveClass('isolate')
    expect(element.querySelector('tbody tr')).toHaveClass('hairline-b')

    const cells = within(element.querySelector('tbody')!).getAllByRole('cell')
    expect(cells[0]).toHaveClass('px-3', 'py-2')
    expect(cells[0]).not.toHaveClass('text-right')
    expect(cells[1]).toHaveClass('whitespace-nowrap', 'text-right', 'tabular-nums')
    expect(cells[2]).toHaveClass('whitespace-nowrap', 'text-right')
  })

  it('offers icon-only edit and delete buttons named for their row, the delete icon in danger', async () => {
    const user = userEvent.setup()
    const edit = vi.fn()
    const remove = vi.fn()
    render(
      <>
        <EditButton label="Edit Car" onClick={edit} />
        <DeleteButton label="Delete Car" onClick={remove} />
      </>,
    )

    for (const name of ['Edit Car', 'Delete Car']) {
      const button = screen.getByRole('button', { name })
      expect(button.textContent).toBe('')
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveClass('size-10', 'text-primary')
    }
    expect(screen.getByRole('button', { name: 'Delete Car' }).querySelector('svg')).toHaveClass('text-danger')

    await user.click(screen.getByRole('button', { name: 'Edit Car' }))
    await user.click(screen.getByRole('button', { name: 'Delete Car' }))
    expect(edit).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe('list states', () => {
  it('announces loading with a spinner that respects reduced motion', () => {
    render(<ListLoading>Loading things…</ListLoading>)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading things…')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelector('svg')).toHaveClass('animate-spin', 'motion-reduce:animate-none')
  })

  it('reports a load failure with a Retry button', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    render(<ListLoadError onRetry={retry}>Things could not be loaded.</ListLoadError>)

    expect(screen.getByRole('alert')).toHaveTextContent('Things could not be loaded.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('says an empty list is empty in a card, with no table', () => {
    render(<ListEmpty title={<h2>Things</h2>}>No things yet.</ListEmpty>)

    expect(screen.getByText('No things yet.')).toHaveClass('text-fg-secondary')
    expect(screen.getByText('No things yet.').closest('[data-slot="card"]'))
      .toContainElement(screen.getByRole('heading', { name: 'Things' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
