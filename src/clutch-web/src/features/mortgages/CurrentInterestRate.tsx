import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatPercent } from './FormattedNumberField'
import { InterestRateChangesDialog } from './InterestRateChangesDialog'
import { currentInterestRate, type DraftErrors, type LoanDraft, type RateRowDraft } from './loanDraft'

type CurrentInterestRateProps = {
  draft: LoanDraft
  today: string
  errors: DraftErrors
  saving: boolean
  onRowsChange: (rows: RateRowDraft[]) => void
}

/** The rate in force today, and the "Change Interest Rate" button with the dialog it opens. */
export function CurrentInterestRate({ draft, today, errors, saving, onRowsChange }: CurrentInterestRateProps) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const rate = currentInterestRate(draft.rows, today)

  return (
    <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
      <dl className="min-w-0">
        <dt className="text-xs text-fg-secondary" id={`${id}-label`}>Current Interest Rate</dt>
        <dd aria-labelledby={`${id}-label`} className="text-right text-sm font-medium tabular-nums">
          {rate === null ? 'Not set' : formatPercent(rate)}
        </dd>
      </dl>
      <Button
        disabled={saving}
        onClick={() => setOpen(true)}
        ref={trigger}
        type="button"
        variant="neutral"
      >
        Change Interest Rate
      </Button>
      <InterestRateChangesDialog
        draft={draft}
        errors={errors}
        finalFocus={trigger}
        onOpenChange={setOpen}
        onRowsChange={onRowsChange}
        open={open}
        saving={saving}
        today={today}
      />
    </div>
  )
}
