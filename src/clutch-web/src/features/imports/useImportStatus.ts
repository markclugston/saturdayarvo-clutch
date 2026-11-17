import { focusManager, onlineManager, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ImportStatus } from '@/lib/api/schemas'
import { getImportStatus } from './api'

export const importStatusKey = (accountId: string, reviewId?: string) =>
  ['importStatus', accountId, reviewId ?? null] as const

const subscribeFocus = (notify: () => void) => focusManager.subscribe(notify)
const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify)
const isFocused = () => focusManager.isFocused()
const isOnline = () => onlineManager.isOnline()

type StatusCheck = {
  status: ImportStatus
  validationToken: symbol
}

export function useImportStatus(accountId: string, reviewId?: string, enabled = true) {
  const queryClient = useQueryClient()
  const queryKey = importStatusKey(accountId, reviewId)
  const [validationToken, setValidationToken] = useState(() => Symbol())
  const currentValidationToken = useRef(validationToken)
  const requireValidation = useCallback(() => {
    const token = Symbol()
    currentValidationToken.current = token
    setValidationToken(token)
  }, [])
  const focused = useSyncExternalStore(subscribeFocus, isFocused)
  const online = useSyncExternalStore(subscribeOnline, isOnline)
  const active = focused && online && enabled
  const needsValidation = queryClient.getQueryData<StatusCheck>(queryKey)?.validationToken !== validationToken
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      // An older request cannot satisfy a newer restoration or explicit check.
      const requestToken = currentValidationToken.current
      const status = await getImportStatus(accountId, reviewId, AbortSignal.any([signal, AbortSignal.timeout(2000)]))
      const previous = queryClient.getQueryData<StatusCheck>(importStatusKey(accountId, reviewId))
      return {
        status: previous?.status.watchedImport?.state === 'Ended' ? previous.status : status,
        validationToken: requestToken,
      }
    },
    select: (check) => check.status,
    notifyOnChangeProps: needsValidation ? ['data', 'error', 'status', 'fetchStatus'] : ['data', 'error', 'status'],
    enabled: (query) => active && query.state.data?.status.watchedImport?.state !== 'Ended',
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: (query) => active && query.state.data?.status.watchedImport?.state !== 'Ended' ? 2000 : false,
  })

  useEffect(() => {
    if (!focused || !online) {
      requireValidation()
      void queryClient.cancelQueries({ queryKey: importStatusKey(accountId, reviewId), exact: true })
    }
  }, [focused, online, accountId, reviewId, queryClient, requireValidation])

  useEffect(() => {
    const refresh = async () => {
      requireValidation()
      await queryClient.cancelQueries({ queryKey: importStatusKey(accountId, reviewId), exact: true })
      await queryClient.invalidateQueries({ queryKey: importStatusKey(accountId, reviewId), exact: true })
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [accountId, reviewId, queryClient, requireValidation])

  return {
    ...query,
    refetch: async () => {
      requireValidation()
      await queryClient.cancelQueries({ queryKey, exact: true })
      return query.refetch()
    },
    fresh: active && query.isSuccess && !needsValidation,
  }
}
