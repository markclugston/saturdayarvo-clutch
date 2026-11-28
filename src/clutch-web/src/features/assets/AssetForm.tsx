import { Plus } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import {
  DeleteButton, ListActionsCell, ListActionsHeader, ListBody, ListCard, ListCell, ListHead, ListHeaderCell,
  ListRow, ListTable,
} from '@/components/ui/list'
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

const NO_VALUATIONS_MESSAGE = 'No valuations yet. Add a valuation to record what this asset is worth.'

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
  const valuationsError = errors.valuations
    ? <ErrorMessage className="text-sm">{errors.valuations}</ErrorMessage>
    : null

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

      <ListCard
        aria-labelledby="valuations-heading"
        as="section"
        className="max-w-xl"
        empty={draft.valuations.length === 0
          ? (
            <>
              <p className="text-fg-secondary">{NO_VALUATIONS_MESSAGE}</p>
              {valuationsError}
            </>
          )
          : undefined}
        end={valuationsError}
        label="Valuations"
        title={(
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
        )}
      >
        <ListTable caption="Valuations of this asset, newest first">
          <ListHead>
            <tr>
              <ListHeaderCell numeric>Value</ListHeaderCell>
              <ListHeaderCell>Valuation Date</ListHeaderCell>
              <ListActionsHeader />
            </tr>
          </ListHead>
          <ListBody>
            {newestFirst(draft.valuations).map((row) => {
              const date = formatDisplayDate(row.date)
              const rowErrors = [errors[`${row.key}.value`], errors[`${row.key}.date`]]
                .filter((message): message is string => Boolean(message))
              return (
                <ListRow key={row.key}>
                  <ListCell numeric>
                    {currency
                      ? formatAssetValue(row.value, currency.code, currency.minorUnits)
                      : row.value}
                    {rowErrors.map((message) => (
                      <ErrorMessage className="mt-1 justify-end whitespace-normal text-xs" key={message}>{message}</ErrorMessage>
                    ))}
                  </ListCell>
                  <ListCell className="whitespace-nowrap">{date}</ListCell>
                  <ListActionsCell>
                    <DeleteButton
                      disabled={locked}
                      label={`Delete valuation dated ${date}`}
                      onClick={() => {
                        onChange(removeValuation(draft, row.key))
                        addButton.current?.focus()
                      }}
                    />
                  </ListActionsCell>
                </ListRow>
              )
            })}
          </ListBody>
        </ListTable>
      </ListCard>

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
