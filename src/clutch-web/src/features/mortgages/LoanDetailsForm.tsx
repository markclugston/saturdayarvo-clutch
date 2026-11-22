import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { getAccounts } from '@/features/accounts/api'
import type { Mortgage } from '@/lib/api/schemas'
import {
  MortgageChangedError,
  MortgageGoneError,
  MortgageUnauthorizedError,
  MortgageValidationError,
  createMortgage,
  updateMortgage,
} from './api'
import { DeleteMortgageControl } from './DeleteMortgageControl'
import { FormattedNumberField, formatCurrency } from './FormattedNumberField'
import { CurrentInterestRate } from './CurrentInterestRate'
import {
  draftToInput,
  draftsEqual,
  emptyDraft,
  localToday,
  mapServerErrors,
  mortgageToDraft,
  validateDraft,
  type DraftErrors,
  type LoanDraft,
} from './loanDraft'

export const SAVE_FAILED_MESSAGE = 'The mortgage could not be saved. Please try again.'
export const CONFLICT_MESSAGE = 'This mortgage was changed elsewhere; reload to see the latest'
export const RELOAD_FAILED_MESSAGE = 'The latest version could not be loaded. Please try again.'

type LoanDetailsFormProps = {
  /** The saved mortgage being edited; omit for a new one. */
  mortgage?: Mortgage
  onSaved: (mortgage: Mortgage, created: boolean) => void
  /** A delete succeeded. */
  onDeleted: (id: string) => void
  /** The mortgage is gone (404 on save or delete). */
  onGone: () => void
  /** Refetches the mortgages after a delete clash. Rejects when they cannot be loaded. */
  onReloadAll: () => Promise<void>
  /** A save returned 401. */
  onUnauthorized: () => void
  /** Fetches the latest saved version. Resolves null when the mortgage is gone. */
  onReload: () => Promise<Mortgage | null>
  /** The drop-down's current account id ('' for none), reported on load and on every change. */
  onAccountChange?: (accountId: string) => void
}

// Errors without a field of their own; the set-level interestRateChanges message also shows in the
// Change Interest Rate dialog.
const nonFieldKeys = ['mortgages', 'version', 'interestRateChanges']
const rateRowKey = /\.(newInterestRate|effectiveDate)$/

export function LoanDetailsForm({
  mortgage,
  onSaved,
  onDeleted,
  onGone,
  onReloadAll,
  onUnauthorized,
  onReload,
  onAccountChange,
}: LoanDetailsFormProps) {
  const idPrefix = useId()
  const { isDirty: guardDirty, setDirty, run } = useUnsavedChanges()
  const [baseline, setBaseline] = useState<Mortgage | undefined>(mortgage)
  const [draft, setDraft] = useState<LoanDraft>(() => (mortgage ? mortgageToDraft(mortgage) : emptyDraft()))
  const [seenMortgage, setSeenMortgage] = useState(mortgage)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [reloadFailed, setReloadFailed] = useState(false)

  const savedDraft = baseline ? mortgageToDraft(baseline) : emptyDraft()
  const dirty = !draftsEqual(draft, savedDraft)

  // Saved values load only on first load, tab switch, Cancel, a successful save or Reload. A background
  // refetch replaces them only while nothing is being edited, so it never overwrites the user's entries.
  if (mortgage !== seenMortgage) {
    setSeenMortgage(mortgage)
    if (!dirty && mortgage) {
      setBaseline(mortgage)
      setDraft(mortgageToDraft(mortgage))
    }
  }

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, guardDirty, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])

  const today = localToday()

  // A failed load leaves only None; the form stays usable.
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const accountOptions = useMemo(
    () => [...(accountsQuery.data ?? [])].sort((left, right) =>
      left.description.localeCompare(right.description, undefined, { sensitivity: 'base' })),
    [accountsQuery.data],
  )
  // A linked id missing from the list shows as none; saving is not blocked.
  const shownAccountId = accountOptions.some((account) => account.id === draft.accountId)
    ? draft.accountId
    : ''
  useEffect(() => {
    onAccountChange?.(draft.accountId)
  }, [draft.accountId, onAccountChange])

  function change(patch: Partial<LoanDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function adopt(saved: Mortgage | undefined) {
    setBaseline(saved)
    setDraft(saved ? mortgageToDraft(saved) : emptyDraft())
    setErrors({})
    setSaveFailed(false)
    setConflict(false)
    setReloadFailed(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clientErrors = validateDraft(draft, today)
    setSaveFailed(false)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setErrors({})
    setSaving(true)
    const { input, rowKeys } = draftToInput(draft)
    try {
      const saved = baseline
        ? await updateMortgage(baseline.id, baseline.version, input)
        : await createMortgage(input)
      setSaving(false)
      adopt(saved)
      onSaved(saved, baseline === undefined)
    } catch (error) {
      setSaving(false)
      if (error instanceof MortgageValidationError) {
        setErrors(mapServerErrors(error.fieldErrors, rowKeys))
      } else if (error instanceof MortgageChangedError) {
        setConflict(true)
      } else if (error instanceof MortgageGoneError) {
        onGone()
      } else if (error instanceof MortgageUnauthorizedError) {
        onUnauthorized()
      } else {
        setSaveFailed(true)
      }
    }
  }

  async function reload() {
    setReloading(true)
    setReloadFailed(false)
    try {
      const latest = await onReload()
      setReloading(false)
      if (latest) {
        adopt(latest)
      }
    } catch (error) {
      setReloading(false)
      if (error instanceof MortgageUnauthorizedError) {
        onUnauthorized()
      } else {
        setReloadFailed(true)
      }
    }
  }

  const nonFieldMessages = nonFieldKeys
    .map((key) => errors[key])
    .filter((message): message is string => Boolean(message))
  const fieldErrorKeys = Object.keys(errors).filter((key) => !nonFieldKeys.includes(key))
  const hasFieldErrors = fieldErrorKeys.length > 0
  // Rate rows are only visible in the dialog, so point there when they are the only fields to fix.
  const onlyRateRowErrors = hasFieldErrors && fieldErrorKeys.every((key) => rateRowKey.test(key))
  const showSummary = hasFieldErrors || nonFieldMessages.length > 0

  return (
    <form
      aria-labelledby={`${idPrefix}-heading`}
      className="space-y-4 rounded-card bg-card p-4 xl:p-5"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold" id={`${idPrefix}-heading`}>Details</h2>
        {baseline && (
          <DeleteMortgageControl
            mortgage={baseline}
            onDeleted={onDeleted}
            onGone={() => onGone()}
            onReload={onReloadAll}
            onUnauthorized={onUnauthorized}
          />
        )}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <FloatingField
          autoComplete="off"
          className="w-full sm:w-72"
          disabled={saving}
          error={errors.name}
          id={`${idPrefix}-name`}
          label="Name"
          onChange={(event) => change({ name: event.currentTarget.value })}
          value={draft.name}
        />
        <FormattedNumberField
          autoComplete="off"
          className="w-full sm:w-56"
          disabled={saving}
          error={errors.openingBalance}
          format={formatCurrency}
          id={`${idPrefix}-balance`}
          inputMode="decimal"
          label="Opening Balance"
          onValueChange={(openingBalance) => change({ openingBalance })}
          value={draft.openingBalance}
        />
        <FloatingField
          className="w-full sm:w-52"
          disabled={saving}
          error={errors.drawdownDate}
          id={`${idPrefix}-drawdown-date`}
          label="Drawdown Date"
          onChange={(event) => change({ drawdownDate: event.currentTarget.value })}
          type="date"
          value={draft.drawdownDate}
        />
        <FloatingField
          autoComplete="off"
          className="w-full sm:w-44"
          disabled={saving}
          error={errors.duration}
          id={`${idPrefix}-duration`}
          inputMode="numeric"
          label="Duration"
          onChange={(event) => change({ duration: event.currentTarget.value })}
          value={draft.duration}
        />
        <FloatingField
          as="select"
          className="w-full sm:w-52"
          disabled={saving}
          error={errors.paymentFrequency}
          id={`${idPrefix}-frequency`}
          label="Payment Frequency"
          onChange={(event) => change({
            paymentFrequency: event.currentTarget.value as LoanDraft['paymentFrequency'],
          })}
          value={draft.paymentFrequency}
        >
          <option value="">Choose…</option>
          <option value="Weekly">Weekly</option>
          <option value="Fortnightly">Fortnightly</option>
          <option value="Monthly">Monthly</option>
        </FloatingField>
        <FloatingField
          as="select"
          className="w-full sm:w-64"
          disabled={saving}
          error={errors.accountId}
          id={`${idPrefix}-account`}
          label="Mortgage Account"
          onChange={(event) => change({ accountId: event.currentTarget.value })}
          value={shownAccountId}
        >
          <option value="">None</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>{account.description}</option>
          ))}
        </FloatingField>
      </div>

      <CurrentInterestRate
        draft={draft}
        errors={errors}
        onRowsChange={(rows) => change({ rows })}
        saving={saving}
        today={today}
      />

      {showSummary && (
        <div className="space-y-1 text-sm text-danger" role="alert">
          {hasFieldErrors && (
            <p>
              {onlyRateRowErrors
                ? 'Correct the interest rate changes in Change Interest Rate and try again.'
                : 'Correct the highlighted fields and try again.'}
            </p>
          )}
          {nonFieldMessages.map((message) => <p key={message}>{message}</p>)}
        </div>
      )}
      {conflict && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <ErrorMessage role="presentation">{CONFLICT_MESSAGE}</ErrorMessage>
          <Button
            disabled={reloading}
            onClick={() => run(() => void reload())}
            type="button"
            variant="secondary"
          >
            {reloading ? 'Reloading…' : 'Reload'}
          </Button>
        </div>
      )}
      {reloadFailed && <ErrorMessage>{RELOAD_FAILED_MESSAGE}</ErrorMessage>}
      {saveFailed && <ErrorMessage>{SAVE_FAILED_MESSAGE}</ErrorMessage>}

      <div className="flex flex-wrap gap-2">
        <Button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save'}</Button>
        <Button
          disabled={saving}
          onClick={() => adopt(baseline)}
          type="button"
          variant="secondary"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
