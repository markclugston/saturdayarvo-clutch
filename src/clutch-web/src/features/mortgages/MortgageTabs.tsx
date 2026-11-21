import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import type { Mortgage } from '@/lib/api/schemas'
import { cn } from '@/lib/utils'
import { MAX_MORTGAGES } from './loanDraft'

export const LIMIT_MESSAGE = 'You can save up to 20 mortgages'

/** `'new'` is the "Add Mortgage" tab. */
export type TabSelection = string

type MortgageTabsProps = {
  mortgages: Mortgage[]
  selected: TabSelection
  onSelect: (id: string) => void
  onAdd: () => void
}

const tabClass = 'min-h-10 max-w-48 cursor-pointer truncate rounded-control px-3 text-sm font-medium hover:bg-hover focus-visible:focus-ring aria-[current=true]:bg-selected aria-[current=true]:text-primary'

export function MortgageTabs({
  mortgages,
  selected,
  onSelect,
  onAdd,
}: MortgageTabsProps) {
  const { run } = useUnsavedChanges()
  const atLimit = mortgages.length >= MAX_MORTGAGES

  return (
    <nav aria-label="Mortgages">
      <ul className="flex items-center gap-2 overflow-x-auto pb-1">
        {mortgages.map((mortgage) => (
          <li className="flex shrink-0 items-center" key={mortgage.id}>
            <button
              aria-current={mortgage.id === selected ? 'true' : undefined}
              className={tabClass}
              onClick={() => {
                if (mortgage.id !== selected) {
                  run(() => onSelect(mortgage.id))
                }
              }}
              title={mortgage.name}
              type="button"
            >
              {mortgage.name}
            </button>
          </li>
        ))}
        <li className="shrink-0">
          <button
            aria-current={selected === 'new' ? 'true' : undefined}
            aria-describedby={atLimit ? 'mortgage-limit-hint' : undefined}
            aria-disabled={atLimit ? 'true' : undefined}
            className={cn(tabClass, atLimit && 'cursor-not-allowed opacity-60')}
            onClick={() => {
              if (!atLimit && selected !== 'new') {
                run(onAdd)
              }
            }}
            title={atLimit ? LIMIT_MESSAGE : undefined}
            type="button"
          >
            Add Mortgage
          </button>
          {atLimit && <span className="sr-only" id="mortgage-limit-hint">{LIMIT_MESSAGE}</span>}
        </li>
      </ul>
    </nav>
  )
}
