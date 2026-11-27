import { Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { formatDisplayDate } from '@/features/mortgages/loanDraft'
import type { Currency } from '@/lib/api/schemas'
import { AddValuationDialog } from './AddValuationDialog'
import {
  addValuation,
  formatAssetValue,
  newestFirst,
  removeValuation,
  type AssetDraft,
  type AssetDraftErrors,
} from './assetDraft'

type AssetFormProps = {
  draft: AssetDraft
  errors: AssetDraftErrors
  currencies: Currency[]
  /** A saved asset's currency cannot change, so it is shown as text (029 FR-007). */
  currencyFixed?: boolean
  /** A Save is in flight. */
  saving: boolean
  /** Editing is paused until the edit is checked again; leaving stays possible. */
  disabled?: boolean
  onChange: (draft: AssetDraft) => void
  onSave: () => void
  onCancel: () => void
}

export function AssetForm({
  draft,
  errors,
  currencies,
  currencyFixed = false,
  saving,
  disabled = false,
  onChange,
  onSave,
  onCancel,
}: AssetFormProps) {
  const [adding, setAdding] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const currency = currencies.find((candidate) => candidate.code === draft.currencyCode)
  const locked = disabled || saving

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!locked) {
      onSave()
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      {currencyFixed && (
        <p className="text-fg-secondary">
          Currency: {currency ? `${currency.name} (${currency.code})` : draft.currencyCode}
        </p>
      )}
      <Card className="max-w-xl space-y-4">
        <FloatingField
          autoComplete="off"
          disabled={locked}
          error={errors.name}
          id="asset-name"
          label="Name"
          onChange={(event) => onChange({ ...draft, name: event.currentTarget.value })}
          required
          value={draft.name}
        />
        <FloatingField
          autoComplete="off"
          disabled={locked}
          error={errors.description}
          id="asset-description"
          label="Description"
          onChange={(event) => onChange({ ...draft, description: event.currentTarget.value })}
          value={draft.description}
        />
        {!currencyFixed && (
          <FloatingField
            as="select"
            disabled={locked}
            error={errors.currencyCode}
            id="asset-currency"
            label="Currency"
            onChange={(event) => onChange({ ...draft, currencyCode: event.currentTarget.value })}
            required
            value={draft.currencyCode}
          >
            <option value="">Select a currency</option>
            {currencies.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name} ({option.code})
              </option>
            ))}
          </FloatingField>
        )}
      </Card>

      <Card aria-labelledby="valuations-heading" as="section" className="max-w-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle as="h2" id="valuations-heading">Valuations</CardTitle>
          <Button
            disabled={locked || !currency}
            onClick={() => setAdding(true)}
            ref={addButton}
            type="button"
            variant="secondary"
          >
            <Plus aria-hidden="true" />
            Add Valuation
          </Button>
        </div>
        {draft.valuations.length === 0 ? (
          <p className="text-sm text-fg-secondary">No valuations yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Valuations of this asset, newest first</caption>
            <thead className="bg-raised">
              <tr>
                <th className="px-3 py-2 text-right" scope="col">Value</th>
                <th className="px-3 py-2" scope="col">Valuation Date</th>
                <th className="px-3 py-2 text-right" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {newestFirst(draft.valuations).map((row) => {
                const date = formatDisplayDate(row.date)
                const rowErrors = [errors[`${row.key}.value`], errors[`${row.key}.date`]]
                  .filter((message): message is string => Boolean(message))
                return (
                  <tr className="hairline-b" key={row.key}>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {currency
                        ? formatAssetValue(row.value, currency.code, currency.minorUnits)
                        : row.value}
                      {rowErrors.map((message) => (
                        <ErrorMessage className="mt-1 justify-end text-xs" key={message}>{message}</ErrorMessage>
                      ))}
                    </td>
                    <td className="px-3 py-2">{date}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        aria-label={`Delete valuation dated ${date}`}
                        disabled={locked}
                        onClick={() => {
                          onChange(removeValuation(draft, row.key))
                          addButton.current?.focus()
                        }}
                        size="icon"
                        type="button"
                        variant="tertiary"
                      >
                        <Trash2 aria-hidden="true" className="size-4 text-danger" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {errors.valuations && <ErrorMessage className="text-sm">{errors.valuations}</ErrorMessage>}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button disabled={locked} type="submit">{saving ? 'Saving…' : 'Save'}</Button>
        <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
      </div>

      {adding && currency && (
        <AddValuationDialog
          currency={currency}
          disabled={locked}
          draft={draft}
          finalFocus={addButton}
          onAdd={(value, date) => onChange(addValuation(draft, value, date))}
          onClose={() => setAdding(false)}
        />
      )}
    </form>
  )
}
