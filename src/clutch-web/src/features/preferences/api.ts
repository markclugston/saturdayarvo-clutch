import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/client'
import {
  NavigationPreferenceSchema,
  ThemePreferenceSchema,
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
