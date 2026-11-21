import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { useToast } from '@/components/ui/toast'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import type { Mortgage } from '@/lib/api/schemas'
import { AmortizationSchedule } from './AmortizationSchedule'
import { BurnDownChart } from './BurnDownChart'
import { LoanDetailsForm } from './LoanDetailsForm'
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

export function MortgagesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { isDirty } = useUnsavedChanges()
  const query = useMortgages()
  // null: the first mortgage (or the empty form when there are none). 'new': the Add mortgage tab.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retained, setRetained] = useState<Mortgage | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

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

  if (query.isPending || (query.isFetching && !mortgages)) {
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
    <div className="space-y-4">
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
      <div className="grid gap-4 md:grid-cols-2">
        <BurnDownChart saved={selectedMortgage !== undefined} />
        <AmortizationSchedule numberOfPeriods={selectedMortgage?.numberOfPeriods} />
      </div>
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
