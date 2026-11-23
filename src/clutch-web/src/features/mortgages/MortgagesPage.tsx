import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { useToast } from '@/components/ui/toast'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import {
  loanPayoffTimelinePreferenceQueryKey,
  useLoanPayoffTimelinePreference,
  useSaveLoanPayoffTimelinePreference,
} from '@/features/preferences/api'
import type { LoanPayoffTimelineView, Mortgage } from '@/lib/api/schemas'
import { LoanDetailsForm, type DraftSchedule } from './LoanDetailsForm'
import { LoanPayoffTimeline } from './LoanPayoffTimeline'
import type { ScheduleInputs } from './scheduleCalculation'
import { MortgageTabs } from './MortgageTabs'
import {
  MortgageUnauthorizedError,
  mortgagesQueryKey,
  useMortgages,
} from './api'
import { returnToSignIn } from './sessionExpiry'
import { SessionExpiredDialog } from './SessionExpiredDialog'

export const LOAD_FAILED_MESSAGE = 'We couldn’t load your mortgages. Please try again.'
export const GONE_MESSAGE = 'This mortgage was deleted elsewhere'
export const SAVED_MESSAGE = 'Mortgage saved'

type MortgagesPageProps = {
  /** The signed-in user's id; keys the saved Loan Payoff Timeline view. */
  userId: string
}

export function MortgagesPage({ userId }: MortgagesPageProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  // Loaded alongside the mortgages; Burndown when nothing is saved or it fails or takes over 2 s.
  const viewPreference = useLoanPayoffTimelinePreference(userId)
  const view: LoanPayoffTimelineView = viewPreference.data?.view ?? 'Burndown'
  const viewSave = useSaveLoanPayoffTimelinePreference()
  const { isDirty } = useUnsavedChanges()
  const query = useMortgages()
  // null: the first mortgage (or the empty form when there are none). 'new': the Add mortgage tab.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retained, setRetained] = useState<Mortgage | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  // The Mortgage Account drop-down's live selection, saved or not; the schedule follows it.
  const [liveAccountId, setLiveAccountId] = useState('')
  // The form's valid Duration, Disbursal Date and Payment Frequency; sizes the schedule of an unsaved mortgage.
  const [draftSchedule, setDraftSchedule] = useState<DraftSchedule | undefined>(undefined)

  // The form's calculation inputs while all are valid; drives the Bank Schedule values.
  const [calculation, setCalculation] = useState<ScheduleInputs | undefined>(undefined)

  const mortgages = query.data
  // The default (first) mortgage is pinned by id so a refetch cannot silently change what is selected.
  const effectiveId = selectedId ?? mortgages?.[0]?.id ?? null
  const found = mortgages?.find((mortgage) => mortgage.id === effectiveId)
  if (found && found !== retained) {
    setRetained(found)
  }

  // A dirty mortgage missing from a refetch keeps its tab and values until a save or delete returns 404.
  const keptWhileDirty = !found && isDirty && effectiveId !== null && effectiveId !== 'new'
    && retained?.id === effectiveId
    ? retained
    : undefined
  const missing = effectiveId !== null && effectiveId !== 'new' && !found && !keptWhileDirty
  const selectedMortgage: Mortgage | undefined = effectiveId === 'new'
    ? undefined
    : found ?? keptWhileDirty ?? (missing ? mortgages?.[0] : undefined)
  if (selectedMortgage && selectedId !== selectedMortgage.id && effectiveId !== 'new') {
    setSelectedId(selectedMortgage.id)
  }
  const tabMortgages = mortgages && keptWhileDirty ? [...mortgages, keptWhileDirty] : mortgages ?? []
  const selectedTab = selectedMortgage?.id ?? 'new'

  function handleUnauthorized() {
    if (isDirty) {
      setSessionExpired(true)
    } else {
      void returnToSignIn(queryClient)
    }
  }

  const loadUnauthorized = query.error instanceof MortgageUnauthorizedError
  useEffect(() => {
    if (loadUnauthorized) {
      if (isDirty) {
        setSessionExpired(true)
      } else {
        void returnToSignIn(queryClient)
      }
    }
  }, [loadUnauthorized, isDirty, queryClient])

  function removeFromCache(id: string) {
    queryClient.setQueryData<Mortgage[]>(
      mortgagesQueryKey,
      (current) => current?.filter((mortgage) => mortgage.id !== id),
    )
  }

  function handleGone(id: string) {
    removeFromCache(id)
    setSelectedId(null)
    toast.show(GONE_MESSAGE)
    void queryClient.invalidateQueries({ queryKey: mortgagesQueryKey })
  }

  async function refetchLatest(): Promise<Mortgage[]> {
    const result = await query.refetch({ throwOnError: true })
    return result.data ?? []
  }

  if (query.isPending || (query.isFetching && !mortgages) || viewPreference.isLoading) {
    return (
      <div className="flex items-center gap-3 text-fg-secondary" role="status">
        <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!mortgages || loadUnauthorized) {
    if (loadUnauthorized) {
      // The session ended: the sign-in screen replaces this page, so show no alert.
      return null
    }
    return (
      <div className="space-y-3">
        <ErrorMessage>{LOAD_FAILED_MESSAGE}</ErrorMessage>
        <Button onClick={() => void query.refetch()} type="button" variant="secondary">Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <MortgageTabs
        mortgages={tabMortgages}
        onAdd={() => setSelectedId('new')}
        onSelect={setSelectedId}
        selected={selectedTab}
      />
      <LoanDetailsForm
        key={selectedMortgage?.id ?? 'new'}
        mortgage={selectedMortgage}
        onDeleted={(id) => {
          removeFromCache(id)
          // After any delete the first remaining mortgage is selected (or the empty state shown).
          setSelectedId(null)
          void queryClient.invalidateQueries({ queryKey: mortgagesQueryKey })
        }}
        onAccountChange={setLiveAccountId}
        onCalculationInputsChange={setCalculation}
        onScheduleChange={setDraftSchedule}
        onGone={() => handleGone(selectedMortgage?.id ?? '')}
        onReloadAll={async () => {
          await refetchLatest()
        }}
        onReload={async () => {
          const latest = (await refetchLatest()).find((mortgage) => mortgage.id === selectedMortgage?.id)
          if (!latest) {
            handleGone(selectedMortgage?.id ?? '')
            return null
          }
          return latest
        }}
        onSaved={(saved, created) => {
          queryClient.setQueryData<Mortgage[]>(mortgagesQueryKey, (current) => {
            const list = current ?? []
            return created
              ? [...list, saved]
              : list.map((mortgage) => (mortgage.id === saved.id ? saved : mortgage))
          })
          setSelectedId(saved.id)
          toast.show(SAVED_MESSAGE)
          void queryClient.invalidateQueries({ queryKey: mortgagesQueryKey })
        }}
        onUnauthorized={handleUnauthorized}
      />
      <LoanPayoffTimeline
        accountId={liveAccountId === '' ? undefined : liveAccountId}
        calculation={calculation}
        disbursalDate={calculation?.disbursalDate ?? selectedMortgage?.disbursalDate ?? draftSchedule?.disbursalDate}
        duration={calculation?.duration ?? selectedMortgage?.duration ?? draftSchedule?.duration}
        paymentFrequency={calculation?.paymentFrequency
          ?? selectedMortgage?.paymentFrequency
          ?? draftSchedule?.paymentFrequency}
        onSwitch={() => {
          const next: LoanPayoffTimelineView = view === 'Burndown' ? 'Schedule' : 'Burndown'
          // The cache is the shown view: set it first, so the switch never waits on the save.
          queryClient.setQueryData(loanPayoffTimelinePreferenceQueryKey(userId), { view: next })
          viewSave.save(next)
        }}
        saved={selectedMortgage !== undefined}
        view={view}
      />
      {sessionExpired && (
        <SessionExpiredDialog
          onSignInAgain={() => {
            setSessionExpired(false)
            void returnToSignIn(queryClient)
          }}
          onStay={() => setSessionExpired(false)}
        />
      )}
    </div>
  )
}
