import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/client'
import type { ImportLimits } from '@/lib/api/schemas'
import { getImportLimits, updateImportLimits } from './api'

type ImportLimitsPageProps = {
  onBack: () => void
}

export function ImportLimitsPage({ onBack }: ImportLimitsPageProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ImportLimits | null>(null)
  const limitsQuery = useQuery({
    queryKey: ['admin', 'import-limits'],
    queryFn: getImportLimits,
  })
  const updateMutation = useMutation({
    mutationFn: updateImportLimits,
    onSuccess: async (limits) => {
      setValues(null)
      queryClient.setQueryData(['admin', 'import-limits'], limits)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'import-limits'] })
    },
  })

  if (limitsQuery.isPending) {
    return <p role="status">Loading import limits…</p>
  }

  if (limitsQuery.isError) {
    return <p role="alert">{getErrorMessage(limitsQuery.error)}</p>
  }

  const limits = limitsQuery.data
  if (!limits) {
    return <p role="alert">Import limits are unavailable.</p>
  }

  const displayedValues = values ?? limits

  function changeValue(key: keyof ImportLimits, value: string) {
    const parsedValue = value === '' ? 0 : Number(value)
    setValues({
      ...(values ?? limits),
      [key]: parsedValue,
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (values) {
      updateMutation.mutate(values)
    }
  }

  return (
    <section aria-labelledby="admin-limits-heading" className="max-w-xl space-y-6">
      <button className="text-sm underline underline-offset-4" onClick={onBack}>
        Back to the application
      </button>
      <div>
        <h1 id="admin-limits-heading" className="text-2xl font-semibold">
          Import limits
        </h1>
        <p className="mt-2 text-muted-foreground">
          These shared settings take effect immediately for all imports.
        </p>
      </div>
      <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
        <LimitInput
          id="max-file-size"
          label="Maximum file size (bytes)"
          value={displayedValues.maxFileSizeBytes}
          onChange={(value) => changeValue('maxFileSizeBytes', value)}
        />
        <LimitInput
          id="max-rows"
          label="Maximum rows per import"
          value={displayedValues.maxRowsPerImport}
          onChange={(value) => changeValue('maxRowsPerImport', value)}
        />
        <LimitInput
          id="max-attempts"
          label="Maximum attempts per user per minute"
          value={displayedValues.maxImportAttemptsPerUserPerMinute}
          onChange={(value) => changeValue('maxImportAttemptsPerUserPerMinute', value)}
        />
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={!values || updateMutation.isPending}
          type="submit"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save limits'}
        </button>
        {updateMutation.isError && <p role="alert">{getErrorMessage(updateMutation.error)}</p>}
      </form>
    </section>
  )
}

type LimitInputProps = {
  id: string
  label: string
  value: number
  onChange: (value: string) => void
}

function LimitInput({ id, label, value, onChange }: LimitInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={id}>{label}</label>
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2"
        id={id}
        min={1}
        onChange={(event) => onChange(event.currentTarget.value)}
        required
        step={1}
        type="number"
        value={value}
      />
    </div>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
