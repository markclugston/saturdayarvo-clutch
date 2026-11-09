import { useEffect, useRef } from 'react'
import { ApiError } from '@/lib/api/client'
import { ThemeModeSchema } from '@/lib/api/schemas'
import { useSaveThemePreference, useThemePreference } from '@/features/preferences/api'
import { useTheme } from './ThemeProvider'

type ThemeSelectorProps = {
  userId: string
}

export function ThemeSelector({ userId }: ThemeSelectorProps) {
  const { mode, setMode } = useTheme()
  const preferenceQuery = useThemePreference(userId)
  const saveMutation = useSaveThemePreference(userId)
  const hasUserSelected = useRef(false)

  useEffect(() => {
    hasUserSelected.current = false
    setMode('Light')
  }, [setMode, userId])

  useEffect(() => {
    if (preferenceQuery.isSuccess && !hasUserSelected.current) {
      setMode(preferenceQuery.data.mode)
    }
  }, [preferenceQuery.data, preferenceQuery.isSuccess, setMode])

  function changeMode(nextMode: typeof mode) {
    hasUserSelected.current = true
    setMode(nextMode)
    saveMutation.mutate(nextMode)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium" htmlFor="theme-mode">
        <span>Theme</span>
        <select
          className="max-w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          id="theme-mode"
          onChange={(event) => changeMode(ThemeModeSchema.parse(event.currentTarget.value))}
          value={mode}
        >
          <option value="Light">Light</option>
          <option value="Dark">Dark</option>
          <option value="System">System</option>
        </select>
      </label>
      {preferenceQuery.isError && (
        <p className="text-xs text-destructive" role="alert">
          Your saved theme could not be loaded. Light is active.
        </p>
      )}
      {saveMutation.isError && (
        <p className="text-xs text-destructive" role="alert">
          {getSaveErrorMessage(saveMutation.error)}
        </p>
      )}
    </div>
  )
}

function getSaveErrorMessage(error: Error): string {
  const detail = error instanceof ApiError
    ? error.problem.detail ?? error.problem.title
    : undefined
  return detail
    ? `${detail} Your selection remains active for this visit.`
    : 'Your theme could not be saved. Your selection remains active for this visit.'
}
