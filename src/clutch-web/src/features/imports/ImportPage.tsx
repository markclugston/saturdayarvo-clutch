import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { PageHeading } from '@/components/ui/page-heading'
import { getAccount, getCurrencies } from '@/features/accounts/api'
import { ApiError } from '@/lib/api/client'
import type { ImportReview } from '@/lib/api/schemas'
import {
  cancelActiveImportReview,
  cancelImportReview,
  confirmImportReview,
  createImportReview,
  getAccountImportSettings,
  type ImportMapping,
} from './api'
import { ImportMappingForm } from './ImportMappingForm'
import { ImportReviewTable } from './ImportReviewTable'
import { readCsvHeaders } from './readCsvHeaders'
import { useImportStatus } from './useImportStatus'
import { ImportEndedDialog } from './ImportEndedDialog'

type ImportPageProps = {
  accountId: string
  onBack: () => void
}

export function ImportPage({ accountId, onBack }: ImportPageProps) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const usedSavedSettings = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[] | null>(null)
  const [readingHeaders, setReadingHeaders] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [review, setReview] = useState<ImportReview | null>(null)
  const [confirmDuplicates, setConfirmDuplicates] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [settingsSaved, setSettingsSaved] = useState<boolean | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [savedMappingError, setSavedMappingError] = useState(false)
  const pauseStatus = () => queryClient.cancelQueries({ queryKey: ['importStatus', accountId] })

  const accountQuery = useQuery({
    queryKey: ['account', accountId],
    queryFn: () => getAccount(accountId),
  })
  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    queryFn: getCurrencies,
  })
  const importSettingsQuery = useQuery({
    queryKey: ['accountImportSettings', accountId],
    queryFn: () => getAccountImportSettings(accountId),
  })
  const createReviewMutation = useMutation({
    onMutate: pauseStatus,
    mutationFn: (mapping: ImportMapping) => {
      if (!file) {
        throw new Error('Choose a CSV file before creating a review.')
      }

      return createImportReview(accountId, file, mapping)
    },
    onSuccess: (createdReview) => {
      setReview(createdReview)
      setFile(null)
      setHeaders(null)
      setConfirmDuplicates(false)
      usedSavedSettings.current = false
      if (fileInput.current) {
        fileInput.current.value = ''
      }
    },
    onError: () => {
      void statusQuery.refetch()
      if (usedSavedSettings.current) {
        setSavedMappingError(true)
        setShowSettings(true)
      }
    },
  })
  const confirmMutation = useMutation({
    onMutate: pauseStatus,
    mutationFn: (confirmPossibleDuplicates: boolean) => {
      if (!review) {
        throw new Error('The import review is no longer available.')
      }

      return confirmImportReview(review.id, confirmPossibleDuplicates)
    },
    onSuccess: async (result) => {
      setImportedCount(result.importedCount)
      setSettingsSaved(result.settingsSaved)
      setReview(null)
      setConfirmDuplicates(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accountImportSettings', accountId] }),
        queryClient.invalidateQueries({ queryKey: ['account', accountId] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions', accountId] }),
      ])
    },
    onError: (error) => {
      void statusQuery.refetch()
      if (!(error instanceof ApiError)
        || error.problem.errors?.code?.[0] !== 'DuplicateConfirmationRequired') {
        return
      }

      const newDuplicateRows = new Set(
        (error.problem.errors.rowNumbers ?? [])
          .map(Number)
          .filter(Number.isInteger),
      )
      setConfirmDuplicates(false)
      setReview((current) => current && ({
        ...current,
        duplicateConfirmationRequired: true,
        rows: current.rows.map((row) => ({
          ...row,
          isPossibleDuplicate: row.isPossibleDuplicate
            || newDuplicateRows.has(row.sourceRowNumber),
        })),
      }))
    },
  })
  const cancelMutation = useMutation({
    onMutate: pauseStatus,
    mutationFn: () => {
      if (!review) {
        throw new Error('The import review is no longer available.')
      }

      return cancelImportReview(review.id)
    },
    onSuccess: () => {
      setReview(null)
      setConfirmDuplicates(false)
      setFileError(null)
      onBack()
    },
    onError: () => { void statusQuery.refetch() },
  })
  const recoverMutation = useMutation({
    onMutate: pauseStatus,
    mutationFn: (targetId: string) => cancelActiveImportReview(accountId, targetId),
    onSuccess: async () => {
      await statusQuery.refetch()
      createReviewMutation.reset()
    },
    onError: () => { void statusQuery.refetch() },
  })
  const busy = createReviewMutation.isPending || confirmMutation.isPending
    || cancelMutation.isPending || recoverMutation.isPending
  const statusQuery = useImportStatus(accountId, review?.id, importedCount === null && !busy)
  const canStart = statusQuery.fresh && statusQuery.data?.availability === 'Available' && !busy
  const canReview = statusQuery.fresh
    && statusQuery.data?.watchedImport?.state === 'Ready'
    && statusQuery.data.activeImport?.id === review?.id
    && statusQuery.data.activeImport?.stage === 'Preview'
    && !busy
  const returnMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account', accountId] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions', accountId] }),
      ])
      onBack()
    },
  })

  const watched = statusQuery.data?.watchedImport
  if (watched?.state === 'Ended') {
    return <ImportEndedDialog userName={watched.endedBy.userName}
      busy={returnMutation.isPending}
      error={returnMutation.isError ? getErrorMessage(returnMutation.error) : undefined}
      onAcknowledge={() => returnMutation.mutate()} />
  }
  if (watched?.state === 'Expired' || watched?.state === 'Unavailable') {
    return (
      <section className="space-y-4" aria-labelledby="import-heading">
        <PageHeading id="import-heading" className="text-2xl font-semibold">Import transactions</PageHeading>
        <p role="status">{watched.state === 'Expired'
          ? 'This import preview has expired.' : 'This import preview is no longer available.'}</p>
        {confirmMutation.isError && <p role="alert">{getErrorMessage(confirmMutation.error)}</p>}
        {cancelMutation.isError && <p role="alert">{getErrorMessage(cancelMutation.error)}</p>}
        {returnMutation.isError && <p role="alert">{getErrorMessage(returnMutation.error)}</p>}
        <button type="button" className="rounded-md border border-border px-4 py-2"
          disabled={returnMutation.isPending} onClick={() => returnMutation.mutate()}>
          {returnMutation.isPending ? 'Returning to transactions…' : 'Return to transactions'}
        </button>
      </section>
    )
  }

  if (accountQuery.isPending || currenciesQuery.isPending || importSettingsQuery.isPending) {
    return <p role="status">Loading import details…</p>
  }

  if (accountQuery.isError) {
    return <p role="alert">{getErrorMessage(accountQuery.error)}</p>
  }

  if (currenciesQuery.isError) {
    return <p role="alert">{getErrorMessage(currenciesQuery.error)}</p>
  }

  const account = accountQuery.data
  const savedMapping = importSettingsQuery.data?.mapping ?? null
  const savedMappingCompatible = headers !== null
    && savedMapping !== null
    && isMappingCompatible(savedMapping, headers)
  const currency = currenciesQuery.data.find(
    (supportedCurrency) => supportedCurrency.code === account.currencyCode,
  )
  if (!currency) {
    return <p role="alert">This account has a currency that is not supported.</p>
  }

  function handleFileChange(selectedFile: File | undefined) {
    setFileError(null)
    setFile(null)
    setHeaders(null)
    setReadingHeaders(false)
    if (!selectedFile) {
      return
    }

    setReadingHeaders(true)
    void readCsvHeaders(selectedFile)
      .then((parsedHeaders) => {
        setFile(selectedFile)
        setHeaders(parsedHeaders)
        setReadingHeaders(false)
      })
      .catch((error: unknown) => {
        setReadingHeaders(false)
        setFileError(error instanceof Error
          ? error.message
          : 'The selected CSV header could not be read.')
      })
  }

  function startReview(mapping: ImportMapping) {
    if (file && canStart) {
      usedSavedSettings.current = false
      createReviewMutation.mutate(mapping)
    }
  }

  return (
    <section aria-labelledby="import-heading" className="space-y-6">
      <button
        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        disabled={busy || (review !== null && !canReview)}
        onClick={() => review ? cancelMutation.mutate() : onBack()}
        type="button"
      >
        {review ? 'Cancel import review' : 'Back to account'}
      </button>
      <div>
        <PageHeading id="import-heading" className="text-2xl font-semibold">
          Import transactions
        </PageHeading>
        <p className="mt-2 text-muted-foreground">
          Destination: {account.description} — {currency.name} ({account.currencyCode})
        </p>
      </div>

      {importedCount === null && statusQuery.isError ? (
        <div className="space-y-2" role="alert">
          <p>Import availability could not be checked. {getErrorMessage(statusQuery.error)}</p>
          <button className="rounded-md border border-border px-3 py-2" type="button"
            onClick={() => {
              recoverMutation.reset()
              void statusQuery.refetch()
            }} disabled={statusQuery.isFetching}>
            {statusQuery.isFetching ? 'Checking import availability…' : 'Retry availability check'}
          </button>
        </div>
      ) : importedCount === null && !statusQuery.fresh && !busy ? (
        <p role="status">Checking import availability…</p>
      ) : null}
      {!review && statusQuery.data?.availability === 'Blocked' && (
        <div className="space-y-2">
          <p role="status">
            {statusQuery.data.activeImport.stage === 'Processing'
              ? 'Another import is processing transactions for this account. Wait for it to finish.'
              : 'Another import is active for this account. A new import cannot start yet.'}
          </p>
          {(statusQuery.fresh || recoverMutation.isPending)
            && statusQuery.data.activeImport.canEnd && (
            <button type="button" className="rounded-md border border-border px-4 py-2 disabled:opacity-50"
              disabled={busy} onClick={() => {
                if (statusQuery.fresh && statusQuery.data?.activeImport?.canEnd) {
                  recoverMutation.mutate(statusQuery.data.activeImport.id)
                }
              }}>
              {recoverMutation.isPending ? 'Ending other import…' : 'End other import'}
            </button>
          )}
        </div>
      )}
      {review && watched?.state === 'Processing' && (
        <p role="status">This import is processing transactions. Wait for it to finish.</p>
      )}
      {recoverMutation.isError && (
        <div role="alert" className="space-y-2">
          <p>{getErrorMessage(recoverMutation.error)}</p>
          {!statusQuery.isError && <button type="button" className="rounded-md border border-border px-3 py-2"
            disabled={statusQuery.isFetching} onClick={() => {
              recoverMutation.reset()
              void statusQuery.refetch()
            }}>{statusQuery.isFetching ? 'Checking import availability…' : 'Retry availability check'}</button>}
        </div>
      )}
      {importedCount !== null ? (
        <div className="space-y-4">
          <p role="status">{importedCount} transactions imported successfully.</p>
          {settingsSaved === false && (
            <p role="alert">
              The transactions were imported, but the default import settings were not saved.
              Your previous settings remain unchanged.
            </p>
          )}
          <button
            className="rounded-md border border-border px-4 py-2"
            onClick={onBack}
            type="button"
          >
            Return to account
          </button>
        </div>
      ) : review ? (
        <>
          <ImportReviewTable review={review} currencyCode={account.currencyCode} />
          {review.duplicateConfirmationRequired && (
            <label className="flex items-start gap-2">
              <input
                checked={confirmDuplicates}
                disabled={!canReview}
                onChange={(event) => setConfirmDuplicates(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>
                I reviewed the possible duplicates and want to import every valid row,
                including the flagged rows.
              </span>
            </label>
          )}
          {confirmMutation.isError && (
            <p role="alert">{getErrorMessage(confirmMutation.error)}</p>
          )}
          {cancelMutation.isError && (
            <p role="alert">{getErrorMessage(cancelMutation.error)}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
              disabled={
                !canReview
                || (review.duplicateConfirmationRequired && !confirmDuplicates)
              }
              onClick={() => confirmMutation.mutate(confirmDuplicates)}
            >
              {confirmMutation.isPending ? 'Importing…' : 'Confirm import'}
            </button>
            <button
              className="rounded-md border border-border px-4 py-2 disabled:opacity-50"
              disabled={!canReview}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel review'}
            </button>
          </div>
        </>
      ) : (
        <>
          {importSettingsQuery.isError && (
            <p role="alert">
              Saved import settings could not be retrieved. No defaults are active; enter
              settings for this import.
            </p>
          )}
          {savedMapping && (
            <div className="space-y-2">
              <p role="status">Using this account’s saved import settings.</p>
              {(!headers || savedMappingCompatible) && (
                <button
                  aria-controls={showSettings ? 'import-mapping' : undefined}
                  aria-expanded={showSettings}
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => setShowSettings((current) => !current)}
                  type="button"
                >
                  {showSettings ? 'Use saved settings' : 'View or change settings'}
                </button>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="csv-file">
              CSV file
            </label>
            <button
              className="rounded-md border border-border px-4 py-2 hover:bg-muted"
              disabled={!canStart}
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              Choose CSV file
            </button>
            <input
              ref={fileInput}
              accept=".csv,text/csv"
              aria-describedby="csv-file-description"
              className="sr-only"
              disabled={!canStart}
              id="csv-file"
              onChange={(event) => handleFileChange(event.currentTarget.files?.[0])}
              tabIndex={-1}
              type="file"
            />
            {file && <p aria-live="polite" className="text-sm">Selected file: {file.name}</p>}
            <p className="text-sm text-muted-foreground" id="csv-file-description">
              Only the header row is read in your browser. The server validates the entire file.
            </p>
          </div>
          {readingHeaders && <p role="status">Reading CSV headers…</p>}
          {fileError && <p role="alert">{fileError}</p>}
          {savedMapping && headers && !savedMappingCompatible && (
            <p role="alert">
              The saved settings do not match this file’s columns. Change the settings
              below before reviewing the import.
            </p>
          )}
          {savedMappingError && (
            <p role="alert">
              The saved settings could not be applied to this file. Review or change the
              settings before trying again.
            </p>
          )}
          {savedMapping && headers && savedMappingCompatible && !showSettings && (
            <button
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
              disabled={!canStart}
              onClick={() => {
                if (!canStart) return
                setSavedMappingError(false)
                usedSavedSettings.current = true
                createReviewMutation.mutate(savedMapping)
              }}
              type="button"
            >
              {createReviewMutation.isPending ? 'Creating review…' : 'Review import with saved settings'}
            </button>
          )}
          {((headers && (!savedMapping || !savedMappingCompatible)) || (savedMapping && showSettings)) && (
              <ImportMappingForm
                amountFormats={currency.amountFormats}
                disabled={!canStart}
                headers={headers}
                initialMapping={savedMapping}
                onSubmit={startReview}
              />
          )}
          {createReviewMutation.isError && (
            <p role="alert">{getErrorMessage(createReviewMutation.error)}</p>
          )}
        </>
      )}
    </section>
  )
}

function getErrorMessage(error: Error): string {
  if (!(error instanceof ApiError)) {
    return 'The request could not be completed.'
  }

  const message = error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
  const row = error.problem.errors?.rowNumber?.[0]
  const field = error.problem.errors?.field?.[0]
  const location = [
    row && /^\d+$/.test(row) ? `Row ${row}` : null,
    field && /^[A-Za-z]+$/.test(field) ? `field: ${field}` : null,
  ].filter(Boolean).join(', ')

  return location ? `${message} (${location})` : message
}

function isMappingCompatible(mapping: ImportMapping, headers: string[]): boolean {
  const amountColumns = mapping.amountMode === 'Signed'
    ? [mapping.signedAmountColumn]
    : mapping.amountMode === 'SeparateIncomingOutgoing'
      ? [mapping.incomingAmountColumn, mapping.outgoingAmountColumn]
      : [mapping.amountColumn, mapping.directionColumn]
  const columns = [mapping.dateColumn, mapping.descriptionColumn, ...amountColumns]
  if (mapping.balanceColumn !== null && mapping.balanceColumn !== undefined) {
    columns.push(mapping.balanceColumn)
  }

  return columns.every((column) =>
    typeof column === 'number' && column >= 0 && column < headers.length)
    && new Set(columns).size === columns.length
}
