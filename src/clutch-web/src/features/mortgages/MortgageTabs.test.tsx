import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import type { Mortgage } from '@/lib/api/schemas'
import { MortgageTabs } from './MortgageTabs'
import { installFakeApi, makeMortgage } from './testSupport'

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
  mortgages: Mortgage[]
  selected?: string
  dirty?: boolean
  onSelect?: (id: string) => void
  onAdd?: () => void
}

function Harness({ mortgages, selected, dirty = false, ...handlers }: HarnessProps) {
  const [current] = useState(selected ?? mortgages[0]?.id ?? 'new')
  return (
    <UnsavedChangesProvider>
      <Dirty dirty={dirty} />
      <MortgageTabs
        mortgages={mortgages}
        onAdd={handlers.onAdd ?? (() => {})}
        onSelect={handlers.onSelect ?? (() => {})}
        selected={current}
      />
    </UnsavedChangesProvider>
  )
}

describe('MortgageTabs', () => {
  const home = makeMortgage({ name: 'Home' })
  const car = makeMortgage({ name: 'Car' })

  beforeEach(() => {
    vi.resetAllMocks()
    installFakeApi([home, car])
  })

  it('is a "Mortgages" navigation list: buttons in creation order, then Add mortgage', () => {
    render(<Harness mortgages={[home, car]} />)

    const nav = screen.getByRole('navigation', { name: 'Mortgages' })
    expect(within(nav).getAllByRole('list')).toHaveLength(1)
    expect(within(nav).getAllByRole('button').map((button) => button.textContent || button.getAttribute('aria-label')))
      .toEqual(['Home', 'Car', 'Add mortgage'])
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Car' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('selects with Enter and Space', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness mortgages={[home, car]} onSelect={onSelect} />)

    screen.getByRole('button', { name: 'Car' }).focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenCalledWith(car.id)
  })

  it('truncates long names visually and keeps the full name in title and accessible name', () => {
    const long = makeMortgage({ name: 'A very long mortgage name that will not fit in a tab' })
    render(<Harness mortgages={[long]} />)

    const tab = screen.getByRole('button', { name: long.name })
    expect(tab).toHaveAttribute('title', long.name)
    expect(tab).toHaveClass('truncate')
  })

  it('has no axe violations', async () => {
    const { container } = render(<Harness mortgages={[home, car]} />)

    const results = await axe.run(container)

    expect(results.violations).toEqual([])
  })
})
