import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/client'
import {
  ThemePreferenceSchema,
  type ThemeMode,
  type ThemePreference,
} from '@/lib/api/schemas'

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
