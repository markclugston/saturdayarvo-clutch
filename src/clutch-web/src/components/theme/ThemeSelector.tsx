import { useEffect, useRef } from 'react'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
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
      <FloatingField
        as="select"
        className="w-40"
        id="theme-mode"
        label="Theme"
        onChange={(event) => changeMode(ThemeModeSchema.parse(event.currentTarget.value))}
        value={mode}
      >
        <option value="Light">Light</option>
        <option value="Dark">Dark</option>
        <option value="System">System</option>
      </FloatingField>
      {preferenceQuery.isError && (
        <ErrorMessage className="text-xs">
          Your saved theme could not be loaded. Light is active.
        </ErrorMessage>
      )}
      {saveMutation.isError && (
        <ErrorMessage className="text-xs">
          {getSaveErrorMessage(saveMutation.error)}
        </ErrorMessage>
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
