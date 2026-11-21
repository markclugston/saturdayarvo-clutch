import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { PageHeading } from '@/components/ui/page-heading'
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
    return <p className="text-fg-secondary" role="status">Loading import limits…</p>
  }

  if (limitsQuery.isError) {
    return <ErrorMessage>{getErrorMessage(limitsQuery.error)}</ErrorMessage>
  }

  const limits = limitsQuery.data
  if (!limits) {
    return <ErrorMessage>Import limits are unavailable.</ErrorMessage>
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
    <section aria-labelledby="admin-limits-heading" className="max-w-xl space-y-4">
      <Button onClick={onBack} type="button" variant="secondary">
        Back to the Application
      </Button>
      <div>
        <PageHeading id="admin-limits-heading">
          Import Limits
        </PageHeading>
        <p className="mt-2 text-fg-secondary">
          These shared settings take effect immediately for all imports.
        </p>
      </div>
      <Card as="form" className="space-y-4" onSubmit={submit}>
        <LimitInput
          id="max-file-size"
          label="Maximum File Size (Bytes)"
          value={displayedValues.maxFileSizeBytes}
          onChange={(value) => changeValue('maxFileSizeBytes', value)}
        />
        <LimitInput
          id="max-rows"
          label="Maximum Rows per Import"
          value={displayedValues.maxRowsPerImport}
          onChange={(value) => changeValue('maxRowsPerImport', value)}
        />
        <LimitInput
          id="max-attempts"
          label="Maximum Attempts per User per Minute"
          value={displayedValues.maxImportAttemptsPerUserPerMinute}
          onChange={(value) => changeValue('maxImportAttemptsPerUserPerMinute', value)}
        />
        <Button disabled={!values || updateMutation.isPending} type="submit">
          {updateMutation.isPending ? 'Saving…' : 'Save Limits'}
        </Button>
        {updateMutation.isError && <ErrorMessage>{getErrorMessage(updateMutation.error)}</ErrorMessage>}
      </Card>
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
    <FloatingField
      id={id}
      label={label}
      min={1}
      onChange={(event) => onChange(event.currentTarget.value)}
      required
      step={1}
      type="number"
      value={value}
    />
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
