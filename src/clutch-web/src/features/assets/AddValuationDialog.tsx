import { useState, type FormEvent, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBackdrop, DialogPopup, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { FloatingField } from '@/components/ui/floating-field'
import { FormattedNumberField } from '@/features/mortgages/FormattedNumberField'
import { localToday } from '@/features/mortgages/loanDraft'
import { formatAssetValue, validateNewValuation, type AssetDraft, type CurrencyPrecision } from './assetDraft'

type AddValuationDialogProps = {
  /** The unsaved asset, for the unique-date rule. */
  draft: AssetDraft
  currency: CurrencyPrecision
  disabled?: boolean
  /** Adds to the unsaved asset only; nothing is stored. */
  onAdd: (value: string, date: string) => void
  onClose: () => void
  /** Receives focus when the dialog closes. */
  finalFocus?: RefObject<HTMLElement | null>
}

export function AddValuationDialog({
  draft,
  currency,
  disabled = false,
  onAdd,
  onClose,
  finalFocus,
}: AddValuationDialogProps) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState('')
  const [errors, setErrors] = useState<{ value?: string; date?: string }>({})

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The dialog's form is portalled but still inside the asset form in React's tree.
    event.stopPropagation()
    if (disabled) {
      return
    }
    const found = validateNewValuation(draft, value, date, [currency], localToday())
    setErrors(found)
    if (found.value || found.date) {
      return
    }
    onAdd(value, date)
    onClose()
  }

  return (
    <Dialog modal onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup finalFocus={finalFocus}>
          <form className="space-y-4" noValidate onSubmit={submit}>
            <DialogTitle>Add Valuation</DialogTitle>
            <FormattedNumberField
              autoComplete="off"
              decimals={currency.minorUnits}
              disabled={disabled}
              error={errors.value}
              format={(raw) => formatAssetValue(raw, currency.code, currency.minorUnits)}
              id="valuation-value"
              inputMode="decimal"
              label="Value"
              onValueChange={setValue}
              value={value}
            />
            <FloatingField
              disabled={disabled}
              error={errors.date}
              id="valuation-date"
              label="Valuation Date"
              onChange={(event) => setDate(event.currentTarget.value)}
              type="date"
              value={date}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={disabled} type="submit">OK</Button>
              <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
