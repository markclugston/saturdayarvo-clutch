import { focusManager, onlineManager, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { EditStatus } from '@/lib/api/schemas'
import { getEditStatus } from './api'

const POLL_MS = 2000
const REQUEST_BOUND_MS = 2000

/** The edit this page holds. `receivedAt` is this browser's clock when the lease arrived. */
export type HeldEdit = {
  editId: string
  expiresAtUtc: string
  serverTimeUtc: string
  receivedAt: number
}

/** Why the held edit is over; null while it is not known to be. */
export type EditLifecycle =
  | { kind: 'ended'; userName: string }
  | { kind: 'expired' }
  | { kind: 'inactive' }
  | null

type StatusCheck = { status: EditStatus; validation: symbol | null }

export const assetEditStatusKey = (assetId: string, editId?: string) =>
  ['assetEditStatus', assetId, editId ?? null] as const

const subscribeFocus = (notify: () => void) => focusManager.subscribe(notify)
const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify)
const isFocused = () => focusManager.isFocused()
const isOnline = () => onlineManager.isOnline()

const isOver = (status?: EditStatus) =>
  status?.watchedEdit !== null && status?.watchedEdit !== undefined && status.watchedEdit.state !== 'Active'

/**
 * Polls an asset's edit status the way `useImportStatus` does: every 2 s while focused and online,
 * each request bounded to 2 s, and a fresh check required after a return before editing resumes.
 * Without a `lease` it watches for the asset to become free.
 */
export function useAssetEditStatus(
  assetId: string,
  { lease, enabled = true }: { lease?: HeldEdit; enabled?: boolean },
) {
  const queryClient = useQueryClient()
  const editId = lease?.editId
  const queryKey = assetEditStatusKey(assetId, editId)
  const [required, setRequired] = useState<symbol | null>(null)
  const requiredRef = useRef(required)
  const requireValidation = useCallback(() => {
    const token = Symbol()
    requiredRef.current = token
    setRequired(token)
  }, [])
  const focused = useSyncExternalStore(subscribeFocus, isFocused)
  const online = useSyncExternalStore(subscribeOnline, isOnline)
  const active = focused && online && enabled

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<StatusCheck> => {
      // An older request cannot satisfy a newer return to the page.
      const validation = requiredRef.current
      const status = await getEditStatus(
        assetId,
        editId,
        AbortSignal.any([signal, AbortSignal.timeout(REQUEST_BOUND_MS)]),
      )
      return { status, validation }
    },
    // A finished edit never changes again, so its answer is kept and checking stops.
    enabled: (current) => active && !isOver(current.state.data?.status),
    refetchInterval: (current) => (active && !isOver(current.state.data?.status) ? POLL_MS : false),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })

  useEffect(() => {
    if (!focused || !online) {
      requireValidation()
    }
    if (!active) {
      void queryClient.cancelQueries({ queryKey: assetEditStatusKey(assetId, editId), exact: true })
    }
  }, [active, focused, online, assetId, editId, queryClient, requireValidation])

  useEffect(() => {
    const refresh = async () => {
      requireValidation()
      const filter = { queryKey: assetEditStatusKey(assetId, editId), exact: true }
      await queryClient.cancelQueries(filter)
      await queryClient.invalidateQueries(filter)
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [assetId, editId, queryClient, requireValidation])

  const [expiredEditId, setExpiredEditId] = useState<string | null>(null)
  // How long is left is the server's own difference, counted from when the lease arrived, so a
  // wrong clock here neither hastens nor delays expiry.
  const deadline = lease
    ? lease.receivedAt + (Date.parse(lease.expiresAtUtc) - Date.parse(lease.serverTimeUtc))
    : null
  useEffect(() => {
    if (editId === undefined || deadline === null) {
      return
    }
    const timer = window.setTimeout(() => setExpiredEditId(editId), Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(timer)
  }, [editId, deadline])

  const status = query.data?.status
  const watched = status?.watchedEdit
  let lifecycle: EditLifecycle = null
  if (editId !== undefined) {
    if (watched?.state === 'Ended') {
      lifecycle = { kind: 'ended', userName: watched.endedBy.userName }
    } else if (watched?.state === 'Expired' || expiredEditId === editId) {
      lifecycle = { kind: 'expired' }
    } else if (watched && watched.state !== 'Active') {
      lifecycle = { kind: 'inactive' }
    }
  }
  const validated = required === null || query.data?.validation === required

  return {
    status,
    lifecycle,
    /** False after a return to the page until one check succeeds. */
    validated,
    /** True while the latest check succeeded and is current; never from an answer cached earlier. */
    fresh: active && query.isSuccess && query.isFetchedAfterMount && validated,
    error: query.error,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true })
      return query.refetch()
    },
  }
}
