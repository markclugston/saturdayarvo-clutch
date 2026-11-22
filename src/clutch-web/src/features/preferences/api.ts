import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/client'
import {
  LoanPayoffTimelinePreferenceSchema,
  NavigationPreferenceSchema,
  ThemePreferenceSchema,
  type LoanPayoffTimelinePreference,
  type LoanPayoffTimelineView,
  type NavigationPreference,
  type NavigationState,
  type ThemeMode,
  type ThemePreference,
} from '@/lib/api/schemas'

export const NAVIGATION_PREFERENCE_TIMEOUT_MS = 2000

export function getNavigationPreference(signal?: AbortSignal): Promise<NavigationPreference> {
  return apiRequest('/api/preferences/navigation', NavigationPreferenceSchema, { signal })
}

export function saveNavigationPreference(state: NavigationState): Promise<NavigationPreference> {
  return apiRequest('/api/preferences/navigation', NavigationPreferenceSchema, {
    method: 'PUT',
    body: JSON.stringify({ state }),
  })
}

export const navigationPreferenceQueryKey = (userId: string) =>
  ['navigationPreference', userId] as const

/**
 * Loads the saved navigation state once the session `userId` is known. The request is aborted
 * after 2 s, so a slow or failed load settles as an error and a late value never arrives.
 */
export function useNavigationPreference(userId: string | undefined) {
  return useQuery({
    queryKey: navigationPreferenceQueryKey(userId ?? ''),
    queryFn: ({ signal }) => {
      const timeout = new AbortController()
      const abort = () => timeout.abort()
      const timer = setTimeout(abort, NAVIGATION_PREFERENCE_TIMEOUT_MS)
      signal.addEventListener('abort', abort)
      return getNavigationPreference(timeout.signal).finally(() => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
      })
    },
    enabled: userId !== undefined && userId.length > 0,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** Saves run one at a time per user, so the last toggle is the last write. */
export function useSaveNavigationPreference(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveNavigationPreference,
    scope: { id: `navigationPreference:${userId ?? ''}` },
    onSuccess: (preference) => {
      if (userId) {
        queryClient.setQueryData(navigationPreferenceQueryKey(userId), preference)
      }
    },
  })
}

export const LOAN_PAYOFF_TIMELINE_PREFERENCE_TIMEOUT_MS = 2000

export type LoanPayoffTimelineSave = {
  view: LoanPayoffTimelineView
  clientId: string
  clientSequence: number
}

export function getLoanPayoffTimelinePreference(signal?: AbortSignal): Promise<LoanPayoffTimelinePreference> {
  return apiRequest('/api/preferences/loan-payoff-timeline', LoanPayoffTimelinePreferenceSchema, { signal })
}

/** `keepalive` lets a save started just before a reload or navigation still reach the server. */
export function saveLoanPayoffTimelinePreference(save: LoanPayoffTimelineSave): Promise<LoanPayoffTimelinePreference> {
  return apiRequest('/api/preferences/loan-payoff-timeline', LoanPayoffTimelinePreferenceSchema, {
    method: 'PUT',
    body: JSON.stringify(save),
    keepalive: true,
  })
}

export const loanPayoffTimelinePreferenceQueryKey = (userId: string) =>
  ['loanPayoffTimelinePreference', userId] as const

/**
 * Loads the saved view once the session `userId` is known. The request is aborted after 2 s, so a
 * slow or failed load settles as an error and a late value never arrives. Nothing re-requests it
 * within the visit: not focus, reconnect, remount, nor a remount after an error, however long the
 * user stays away from Mortgages.
 */
export function useLoanPayoffTimelinePreference(userId: string | undefined) {
  return useQuery({
    queryKey: loanPayoffTimelinePreferenceQueryKey(userId ?? ''),
    queryFn: ({ signal }) => {
      const timeout = new AbortController()
      const abort = () => timeout.abort()
      const timer = setTimeout(abort, LOAN_PAYOFF_TIMELINE_PREFERENCE_TIMEOUT_MS)
      signal.addEventListener('abort', abort)
      return getLoanPayoffTimelinePreference(timeout.signal).finally(() => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
      })
    },
    enabled: userId !== undefined && userId.length > 0,
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
    // Kept for the whole visit, even while Mortgages is closed; sign-out removes it.
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/**
 * One page load's save identity. The server ignores a save from this `clientId` whose sequence is
 * not above the one it stored, so an older save that commits late cannot overwrite a newer one.
 * It lives in module scope so leaving Mortgages and returning never restarts the sequence.
 */
const pageLoad: { clientId: string | null; clientSequence: number } = { clientId: null, clientSequence: 0 }

function nextLoanPayoffTimelineSave(view: LoanPayoffTimelineView): LoanPayoffTimelineSave {
  pageLoad.clientId ??= crypto.randomUUID()
  pageLoad.clientSequence += 1
  return { view, clientId: pageLoad.clientId, clientSequence: pageLoad.clientSequence }
}

/**
 * Every call starts its own save at once: no mutation scope, so nothing waits behind another save.
 * Responses never write the cache; the page sets the view before saving. A failed save shows
 * nothing: the chosen view stays for this visit and the previously saved view applies next time.
 */
export function useSaveLoanPayoffTimelinePreference() {
  const mutation = useMutation({ mutationFn: saveLoanPayoffTimelinePreference })
  return {
    save: (view: LoanPayoffTimelineView) => mutation.mutate(nextLoanPayoffTimelineSave(view)),
  }
}

export function getThemePreference(): Promise<ThemePreference> {
  return apiRequest('/api/preferences/theme', ThemePreferenceSchema)
}

export function saveThemePreference(mode: ThemeMode): Promise<ThemePreference> {
  return apiRequest('/api/preferences/theme', ThemePreferenceSchema, {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  })
}

export const themePreferenceQueryKey = (userId: string) =>
  ['themePreference', userId] as const

export function useThemePreference(userId: string) {
  return useQuery({
    queryKey: themePreferenceQueryKey(userId),
    queryFn: getThemePreference,
    enabled: userId.length > 0,
  })
}

export function useSaveThemePreference(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveThemePreference,
    onSuccess: (preference) => {
      queryClient.setQueryData(themePreferenceQueryKey(userId), preference)
    },
  })
}
