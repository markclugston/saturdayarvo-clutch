import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { PageHeading } from '@/components/ui/page-heading'
import { useToast } from '@/components/ui/toast'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { getCurrencies } from '@/features/accounts/api'
import { localToday } from '@/features/mortgages/loanDraft'
import type { AssetDetail, Currency } from '@/lib/api/schemas'
import {
  acquireEdit,
  assetErrorCode,
  assetFieldErrors,
  assetsQueryKey,
  blockedEditStatus,
  createAsset,
  endOtherEdit,
  isAssetGone,
  releaseEdit,
  saveAsset,
} from './api'
import {
  assetToDraft,
  draftsEqual,
  draftToInput,
  emptyAssetDraft,
  mapServerErrors,
  validateAssetDraft,
  type AssetDraft,
  type AssetDraftErrors,
} from './assetDraft'
import { AssetEditEndedDialog } from './AssetEditEndedDialog'
import { AssetForm } from './AssetForm'
import { useAssetEditStatus, type HeldEdit } from './useAssetEditStatus'

export const SAVE_FAILED_MESSAGE = 'The asset could not be saved. Please try again.'
export const OPEN_FAILED_MESSAGE = 'The asset could not be opened. Please try again.'
export const END_FAILED_MESSAGE = 'The other edit could not be ended. Please try again.'
export const CHECK_FAILED_MESSAGE = 'Edit availability could not be checked.'
export const CURRENCIES_FAILED_MESSAGE = 'The currencies could not be loaded. Please try again.'
export const BLOCKED_MESSAGE = 'This asset is being edited in another session.'
export const GONE_MESSAGE = 'This asset no longer exists.'
export const expiredMessage = (name: string) => `Your edit of ${name} expired.`
export const inactiveMessage = (name: string) => `Your edit of ${name} is no longer active.`

type AssetPageProps = {
  /** Absent when adding a new asset, which takes no edit lease. */
  assetId?: string
  /** Shows the Assets list. */
  onExit: () => void
}

export function AssetPage({ assetId, onExit }: AssetPageProps) {
  return assetId === undefined
    ? <NewAsset onExit={onExit} />
    : <ExistingAsset assetId={assetId} key={assetId} onExit={onExit} />
}

function useCurrencies() {
  return useQuery({ queryKey: ['currencies'], queryFn: getCurrencies })
}

/** Reports unsaved edits to the app's prompt for as long as the form is on screen. */
function useDirtyReport(dirty: boolean) {
  const { setDirty } = useUnsavedChanges()
  useEffect(() => setDirty(dirty), [dirty, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])
}

function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="asset-heading" className="space-y-4">
      <PageHeading id="asset-heading">{title}</PageHeading>
      {children}
    </section>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex items-center gap-3 text-fg-secondary" role="status">
      <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
      <p>{label}</p>
    </div>
  )
}

function LoadFailure({ message, onRetry, onReturn }: {
  message: string
  onRetry: () => void
  onReturn: () => void
}) {
  return (
    <div className="space-y-3">
      <ErrorMessage>{message}</ErrorMessage>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onRetry} type="button" variant="secondary">Retry</Button>
        <Button onClick={onReturn} type="button" variant="neutral">Return To Assets</Button>
      </div>
    </div>
  )
}

/** Validates the draft, and keeps the errors until the field they belong to is changed. */
function useAssetDraft(initial: AssetDraft, currencies: Currency[]) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<AssetDraftErrors>({})
  // A value the chosen currency cannot hold is flagged as soon as the currency changes.
  const valueErrors = Object.fromEntries(
    Object.entries(draft.currencyCode === '' ? {} : validateAssetDraft(draft, currencies, localToday()))
      .filter(([key]) => key.endsWith('.value')),
  )

  return {
    draft,
    errors: { ...errors, ...valueErrors },
    setErrors,
    change(next: AssetDraft) {
      setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
        if (key === 'name' || key === 'description' || key === 'currencyCode') {
          return next[key] === draft[key]
        }
        if (next.currencyCode !== draft.currencyCode && key.endsWith('.value')) {
          return false
        }
        return next.valuations === draft.valuations
          || (key !== 'valuations' && next.valuations.some((row) => key.startsWith(`${row.key}.`)))
      })))
      setDraft(next)
    },
    /** The request to send; null when the draft is invalid, with the errors shown. */
    request() {
      const found = validateAssetDraft(draft, currencies, localToday())
      setErrors(found)
      return Object.keys(found).length > 0 ? null : draftToInput(draft)
    },
  }
}

function NewAsset({ onExit }: { onExit: () => void }) {
  const currencies = useCurrencies()
  const { run } = useUnsavedChanges()

  return (
    <PageFrame title="Add Asset">
      {currencies.isPending ? (
        <Loading label="Loading currencies…" />
      ) : currencies.isError ? (
        <LoadFailure
          message={CURRENCIES_FAILED_MESSAGE}
          onRetry={() => void currencies.refetch()}
          onReturn={() => run(onExit)}
        />
      ) : (
        <NewAssetForm currencies={currencies.data} onExit={onExit} />
      )}
    </PageFrame>
  )
}

function NewAssetForm({ currencies, onExit }: { currencies: Currency[]; onExit: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { run, setDirty } = useUnsavedChanges()
  const [empty] = useState(emptyAssetDraft)
  const form = useAssetDraft(empty, currencies)
  useDirtyReport(!draftsEqual(form.draft, empty))
  const creation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetsQueryKey }),
  })

  function save() {
    const request = form.request()
    if (!request) {
      return
    }
    // Callbacks given here are skipped if the user has left the page meanwhile.
    creation.mutate(request.input, {
      onSuccess: (asset) => {
        setDirty(false)
        toast.show(`${asset.name} was saved.`)
        onExit()
      },
      onError: (error) => {
        const fieldErrors = assetFieldErrors(error)
        if (fieldErrors) {
          form.setErrors(mapServerErrors(fieldErrors, request.rowKeys))
        } else {
          toast.show(SAVE_FAILED_MESSAGE)
        }
      },
    })
  }

  return (
    <AssetForm
      currencies={currencies}
      draft={form.draft}
      errors={form.errors}
      onCancel={() => run(onExit)}
      onChange={form.change}
      onSave={save}
      saving={creation.isPending}
    />
  )
}

type Session =
  | { phase: 'opening' }
  | { phase: 'failed' }
  | { phase: 'blocked'; activeEditId: string }
  | { phase: 'open'; lease: HeldEdit; asset: AssetDetail; loaded: AssetDraft }

/** Why the page leaves an asset it was not asked to leave. */
type Departure = 'gone' | 'expired' | 'inactive'

function ignore() {
  // Releasing is best effort: an edit that is not released expires, or can be ended.
}

/**
 * Opens an existing asset under its edit lease, and releases the lease when the page is left
 * (029 FR-020).
 */
function ExistingAsset({ assetId, onExit }: { assetId: string; onExit: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const currencies = useCurrencies()
  const { run, setDirty } = useUnsavedChanges()
  const [session, setSession] = useState<Session>({ phase: 'opening' })
  /** The edit to release when the page is left. */
  const held = useRef<string | null>(null)
  const mounted = useRef(false)
  const opening = useRef(false)
  const departed = useRef(false)

  const assetName = session.phase === 'open' ? session.asset.name : ''

  function depart(reason: Departure) {
    if (departed.current) {
      return
    }
    departed.current = true
    // An expired edit is still released, so the server records it. Otherwise nothing is held.
    if (reason !== 'expired') {
      held.current = null
    }
    setDirty(false)
    void queryClient.invalidateQueries({ queryKey: assetsQueryKey })
    onExit()
    if (reason === 'expired') {
      toast.showPersistent(expiredMessage(assetName))
    } else {
      toast.show(reason === 'gone' ? GONE_MESSAGE : inactiveMessage(assetName))
    }
  }

  // The request outlives renders, so it reaches the latest `depart`.
  const departRef = useRef(depart)
  useEffect(() => {
    departRef.current = depart
  })

  const open = useCallback(async () => {
    if (opening.current || departed.current) {
      return
    }
    opening.current = true
    setSession({ phase: 'opening' })
    try {
      const { asset, ...lease } = await acquireEdit(assetId)
      if (!mounted.current) {
        // The user left while the asset was opening.
        void releaseEdit(assetId, lease.editId).catch(ignore)
        return
      }
      held.current = lease.editId
      setSession({
        phase: 'open',
        asset,
        loaded: assetToDraft(asset),
        lease: { ...lease, receivedAt: Date.now() },
      })
    } catch (error) {
      if (!mounted.current) {
        return
      }
      const blocked = blockedEditStatus(error)
      if (blocked?.availability === 'Blocked') {
        setSession({ phase: 'blocked', activeEditId: blocked.activeEdit.id })
      } else if (isAssetGone(error)) {
        departRef.current('gone')
      } else {
        setSession({ phase: 'failed' })
      }
    } finally {
      opening.current = false
    }
  }, [assetId])

  useEffect(() => {
    mounted.current = true
    void open()
    const releaseOnUnload = () => {
      if (held.current) {
        void releaseEdit(assetId, held.current, { keepalive: true }).catch(ignore)
      }
    }
    window.addEventListener('pagehide', releaseOnUnload)
    return () => {
      window.removeEventListener('pagehide', releaseOnUnload)
      mounted.current = false
      // Deferred, so a development double mount does not count as leaving.
      queueMicrotask(() => {
        if (!mounted.current && held.current) {
          void releaseEdit(assetId, held.current).catch(ignore)
          held.current = null
        }
      })
    }
  }, [assetId, open])

  const leave = () => run(onExit)

  return (
    <PageFrame title="Edit Asset">
      {session.phase === 'opening' ? (
        <Loading label="Opening asset…" />
      ) : session.phase === 'failed' ? (
        <LoadFailure message={OPEN_FAILED_MESSAGE} onRetry={() => void open()} onReturn={leave} />
      ) : session.phase === 'blocked' ? (
        <BlockedAsset
          activeEditId={session.activeEditId}
          assetId={assetId}
          onFree={() => void open()}
          onGone={() => depart('gone')}
          onReturn={leave}
        />
      ) : currencies.isPending ? (
        <Loading label="Opening asset…" />
      ) : currencies.isError ? (
        <LoadFailure
          message={CURRENCIES_FAILED_MESSAGE}
          onRetry={() => void currencies.refetch()}
          onReturn={leave}
        />
      ) : (
        <OpenAsset
          assetId={assetId}
          currencies={currencies.data}
          key={session.lease.editId}
          lease={session.lease}
          loaded={session.loaded}
          onCancel={leave}
          onDepart={depart}
          onEnded={() => {
            // Nothing is held any more and nothing can be saved, so leaving needs no prompt.
            held.current = null
            setDirty(false)
          }}
          onReturnAfterEnd={() => {
            setDirty(false)
            void queryClient.invalidateQueries({ queryKey: assetsQueryKey })
            onExit()
          }}
          onSaved={(name) => {
            departed.current = true
            held.current = null
            setDirty(false)
            toast.show(`${name} was saved.`)
            onExit()
          }}
        />
      )}
    </PageFrame>
  )
}

type BlockedAssetProps = {
  assetId: string
  /** The edit that refused the open, until a status check names a newer one. */
  activeEditId: string
  onFree: () => void
  onGone: () => void
  onReturn: () => void
}

function BlockedAsset({ assetId, activeEditId, onFree, onGone, onReturn }: BlockedAssetProps) {
  const toast = useToast()
  const ending = useMutation({ mutationFn: (editId: string) => endOtherEdit(assetId, editId) })
  // Paused while ending; resuming checks again at once, whatever the outcome.
  const check = useAssetEditStatus(assetId, { enabled: !ending.isPending })
  const target = check.status?.availability === 'Blocked' ? check.status.activeEdit.id : activeEditId
  const free = check.fresh && check.status?.availability === 'Available'
  const gone = isAssetGone(check.error)

  useEffect(() => {
    if (free) {
      onFree()
    } else if (gone) {
      onGone()
    }
    // The callbacks change every render; only a change in what the check found acts.
  }, [free, gone])

  function end() {
    ending.mutate(target, {
      onSuccess: () => void check.refetch(),
      onError: (error) => {
        if (isAssetGone(error)) {
          onGone()
        } else if (assetErrorCode(error) === 'AssetEditChanged') {
          // Another edit took its place, or none is active now: the next check says which.
          void check.refetch()
        } else {
          toast.show(END_FAILED_MESSAGE)
        }
      },
    })
  }

  return (
    <>
      {check.isError && (
        <CheckFailure checking={check.isFetching} onRetry={() => void check.refetch()} />
      )}
      <Card className="space-y-4">
        <p className="flex items-start gap-2" role="status">
          <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-secondary" />
          <span>{BLOCKED_MESSAGE}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button disabled={ending.isPending} onClick={end} type="button" variant="secondary">
            {ending.isPending ? 'Ending Other Edit…' : 'End Other Edit'}
          </Button>
          <Button onClick={onReturn} type="button" variant="neutral">Return To Assets</Button>
        </div>
      </Card>
    </>
  )
}

function CheckFailure({ checking, onRetry }: { checking: boolean; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ErrorMessage>{CHECK_FAILED_MESSAGE}</ErrorMessage>
      <Button disabled={checking} onClick={onRetry} type="button" variant="secondary">
        Retry Availability Check
      </Button>
    </div>
  )
}

type OpenAssetProps = {
  assetId: string
  lease: HeldEdit
  loaded: AssetDraft
  currencies: Currency[]
  onCancel: () => void
  onDepart: (reason: Departure) => void
  onEnded: () => void
  onReturnAfterEnd: () => void
  onSaved: (name: string) => void
}

function OpenAsset({
  assetId,
  lease,
  loaded,
  currencies,
  onCancel,
  onDepart,
  onEnded,
  onReturnAfterEnd,
  onSaved,
}: OpenAssetProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const form = useAssetDraft(loaded, currencies)
  useDirtyReport(!draftsEqual(form.draft, loaded))
  const saving = useMutation({
    mutationFn: (input: Parameters<typeof saveAsset>[2]) => saveAsset(assetId, lease.editId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetsQueryKey }),
  })
  // While a Save is in flight its own answer decides, so checking and expiry wait for it.
  const check = useAssetEditStatus(assetId, { lease, enabled: !saving.isPending })
  const lifecycle = saving.isPending || saving.isSuccess ? null : check.lifecycle
  const kind = lifecycle?.kind

  useEffect(() => {
    if (kind === 'expired' || kind === 'inactive') {
      onDepart(kind)
    } else if (kind === 'ended') {
      onEnded()
    }
    // The callbacks change every render; only a change in the edit's state acts.
  }, [kind])

  function save() {
    const request = form.request()
    if (!request) {
      return
    }
    saving.mutate(request.input, {
      onSuccess: (asset) => onSaved(asset.name),
      onError: (error) => {
        const code = assetErrorCode(error)
        const fieldErrors = assetFieldErrors(error)
        if (isAssetGone(error)) {
          onDepart('gone')
        } else if (code === 'AssetEditExpired') {
          onDepart('expired')
        } else if (code === 'AssetEditChanged') {
          onDepart('inactive')
        } else if (fieldErrors) {
          form.setErrors(mapServerErrors(fieldErrors, request.rowKeys))
        } else if (code === 'AssetEditEnded') {
          // No message here: the status check names who ended it.
          void check.refetch()
        } else {
          toast.show(SAVE_FAILED_MESSAGE)
        }
      },
    })
  }

  return (
    <>
      {check.isError && (
        <CheckFailure checking={check.isFetching} onRetry={() => void check.refetch()} />
      )}
      {!check.isError && !check.validated && !saving.isPending && (
        <p className="text-fg-secondary" role="status">Checking Edit Availability…</p>
      )}
      <AssetForm
        currencies={currencies}
        currencyFixed
        disabled={!check.validated || kind === 'ended'}
        draft={form.draft}
        errors={form.errors}
        onCancel={onCancel}
        onChange={form.change}
        onSave={save}
        saving={saving.isPending}
      />
      {lifecycle?.kind === 'ended' && (
        <AssetEditEndedDialog onAcknowledge={onReturnAfterEnd} userName={lifecycle.userName} />
      )}
    </>
  )
}
