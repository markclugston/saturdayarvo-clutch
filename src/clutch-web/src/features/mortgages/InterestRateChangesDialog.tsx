import { Plus, X } from 'lucide-react'
import { useId, useRef, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBackdrop, DialogPopup, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { FormattedNumberField, formatPercent } from './FormattedNumberField'
import {
  MAX_RATE_CHANGES,
  formatDisplayDate,
  headerIsValid,
  newRow,
  validateNewRateChange,
  type DraftErrors,
  type LoanDraft,
  type RateRowDraft,
} from './loanDraft'

export const ADD_ROW_HINT = 'Enter the first repayment date, number of periods and repayment frequency first'
export const LIMIT_HINT = `You can add up to ${MAX_RATE_CHANGES} interest rate changes`

type InterestRateChangesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The unsaved Loan details; the dialog edits `rows` only. */
  draft: LoanDraft
  today: string
  /** Errors from the last refused save: `{rowKey}.newInterestRate`, `{rowKey}.effectiveDate`, `interestRateChanges`. */
  errors: DraftErrors
  saving: boolean
  onRowsChange: (rows: RateRowDraft[]) => void
  /** Receives focus when the dialog closes. */
  finalFocus: RefObject<HTMLElement | null>
}

/** Lists, adds and removes interest rate changes as unsaved Loan details edits. It never saves. */
export function InterestRateChangesDialog({
  open,
  onOpenChange,
  draft,
  today,
  errors,
  saving,
  onRowsChange,
  finalFocus,
}: InterestRateChangesDialogProps) {
  const popup = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const canAdd = headerIsValid(draft, today)
  const atLimit = draft.rows.length >= MAX_RATE_CHANGES
  const addAvailable = canAdd && !atLimit && !saving

  return (
    <Dialog modal onOpenChange={(next) => onOpenChange(next)} open={open}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup
          className="flex max-w-lg flex-col gap-4 overflow-hidden"
          finalFocus={finalFocus}
          initialFocus={() => (addAvailable ? popup.current?.querySelector<HTMLInputElement>('input') : close.current) ?? true}
          ref={popup}
          tabIndex={-1}
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Change Interest Rate</DialogTitle>
            <Button
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              ref={close}
              size="icon"
              type="button"
              variant="icon"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {/* Mounted with the popup, so typed values are discarded on close and empty on each open. */}
          <AddArea
            addAvailable={addAvailable}
            atLimit={atLimit}
            canAdd={canAdd}
            draft={draft}
            onAdd={(row) => onRowsChange([...draft.rows, row])}
            today={today}
          />
          <RateList
            errors={errors}
            firstRepaymentDate={draft.firstRepaymentDate}
            onRemove={(key) => {
              onRowsChange(draft.rows.filter((row) => row.key !== key))
              popup.current?.focus()
            }}
            rows={draft.rows}
            saving={saving}
          />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

type AddAreaProps = {
  draft: LoanDraft
  today: string
  canAdd: boolean
  atLimit: boolean
  addAvailable: boolean
  onAdd: (row: RateRowDraft) => void
}

function AddArea({ draft, today, canAdd, atLimit, addAvailable, onAdd }: AddAreaProps) {
  const id = useId()
  const [rate, setRate] = useState('')
  const [date, setDate] = useState('')
  const [addErrors, setAddErrors] = useState<{ newInterestRate?: string; effectiveDate?: string }>({})
  const hintId = `${id}-add-hint`
  const hint = !canAdd ? ADD_ROW_HINT : atLimit ? LIMIT_HINT : null

  function add() {
    const found = validateNewRateChange(draft, rate, date, today)
    setAddErrors(found)
    if (found.newInterestRate || found.effectiveDate) {
      return
    }
    onAdd(newRow(rate.trim(), date))
    setRate('')
    setDate('')
    document.getElementById(`${id}-rate`)?.focus()
  }

  return (
    <div className="shrink-0 space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <FormattedNumberField
          autoComplete="off"
          className="w-full sm:w-40"
          describedBy={hint ? hintId : undefined}
          disabled={!addAvailable}
          error={addErrors.newInterestRate}
          format={formatPercent}
          id={`${id}-rate`}
          inputMode="decimal"
          label="New Interest Rate"
          onValueChange={setRate}
          value={rate}
        />
        <FloatingField
          className="w-full sm:w-44"
          describedBy={hint ? hintId : undefined}
          disabled={!addAvailable}
          error={addErrors.effectiveDate}
          id={`${id}-date`}
          label="Effective Date"
          onChange={(event) => setDate(event.currentTarget.value)}
          type="date"
          value={date}
        />
        <Button
          aria-describedby={hint ? hintId : undefined}
          disabled={!addAvailable}
          onClick={add}
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>
      {hint && <p className="text-xs text-fg-secondary" id={hintId}>{hint}</p>}
    </div>
  )
}

type RateListProps = {
  rows: RateRowDraft[]
  firstRepaymentDate: string
  errors: DraftErrors
  saving: boolean
  onRemove: (key: string) => void
}

function RateList({ rows, firstRepaymentDate, errors, saving, onRemove }: RateListProps) {
  const setError = errors.interestRateChanges
  // Display order only; the draft keeps its own order.
  const sorted = [...rows].sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0))

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {setError && <ErrorMessage className="text-sm">{setError}</ErrorMessage>}
      {sorted.length === 0 ? (
        <p className="text-sm text-fg-secondary">No interest rate changes yet</p>
      ) : (
        <ul aria-label="Interest Rate Changes" className="min-h-0 space-y-2 overflow-y-auto">
          {sorted.map((row) => {
            const rate = formatPercent(row.rate)
            const date = formatDisplayDate(row.date)
            const rowErrors = [errors[`${row.key}.newInterestRate`], errors[`${row.key}.effectiveDate`]]
              .filter((message): message is string => Boolean(message))
            return (
              <li className="rounded-control bg-raised px-3 py-2" key={row.key}>
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{rate}</span>
                    <span className="text-fg-secondary">{date}</span>
                    {row.date === firstRepaymentDate && (
                      <span className="text-xs font-medium text-fg-secondary">Opening Rate</span>
                    )}
                  </div>
                  <Button
                    aria-label={`Remove ${rate} from ${date}`}
                    disabled={saving}
                    onClick={() => onRemove(row.key)}
                    size="icon"
                    type="button"
                    variant="icon"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                {rowErrors.map((message) => (
                  <ErrorMessage className="mt-1 text-xs" key={message} role="presentation">{message}</ErrorMessage>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
