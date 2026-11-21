import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingField } from '@/components/ui/floating-field'
import { FormattedNumberField, formatPercent } from './FormattedNumberField'
import { MAX_RATE_CHANGES, newRow, type DraftErrors, type RateRowDraft } from './loanDraft'

type InterestRateChangesFieldProps = {
  idPrefix: string
  rows: RateRowDraft[]
  errors: DraftErrors
  /** True once First Repayment Date, Number of Periods and Repayment Frequency are all valid. */
  canAdd: boolean
  disabled?: boolean
  onChange: (rows: RateRowDraft[]) => void
}

export const ADD_ROW_HINT = 'Enter the first repayment date, number of periods and repayment frequency first'

export function InterestRateChangesField({
  idPrefix,
  rows,
  errors,
  canAdd,
  disabled = false,
  onChange,
}: InterestRateChangesFieldProps) {
  const atLimit = rows.length >= MAX_RATE_CHANGES
  const addDisabled = disabled || !canAdd || atLimit
  const hintId = `${idPrefix}-add-hint`
  const setError = errors.interestRateChanges
  const hint = !canAdd
    ? ADD_ROW_HINT
    : atLimit
      ? `You can add up to ${MAX_RATE_CHANGES} interest rate changes`
      : null

  function update(key: string, patch: Partial<RateRowDraft>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold">Interest Rate Changes</legend>
      {rows.map((row, index) => {
        const number = index + 1
        return (
          <div className="flex flex-wrap items-start gap-3" key={row.key}>
            <FormattedNumberField
              autoComplete="off"
              className="w-full sm:w-48"
              disabled={disabled}
              error={errors[`${row.key}.newInterestRate`]}
              format={formatPercent}
              id={`${idPrefix}-${row.key}-rate`}
              inputMode="decimal"
              label="New Interest Rate"
              onValueChange={(rate) => update(row.key, { rate })}
              value={row.rate}
            />
            <FloatingField
              className="w-full sm:w-48"
              disabled={disabled}
              error={errors[`${row.key}.effectiveDate`]}
              id={`${idPrefix}-${row.key}-date`}
              label="Effective Date"
              onChange={(event) => update(row.key, { date: event.currentTarget.value })}
              type="date"
              value={row.date}
            />
            <Button
              aria-label={`Remove interest rate change ${number}`}
              disabled={disabled}
              onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}
              size="icon"
              type="button"
              variant="icon"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )
      })}
      {setError && (
        <p className="text-sm text-danger" id={`${idPrefix}-set-error`}>{setError}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          aria-describedby={hint ? hintId : undefined}
          disabled={addDisabled}
          onClick={() => onChange([...rows, newRow()])}
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" />
          Add interest rate change
        </Button>
        {hint && <p className="text-xs text-fg-secondary" id={hintId}>{hint}</p>}
      </div>
    </fieldset>
  )
}
