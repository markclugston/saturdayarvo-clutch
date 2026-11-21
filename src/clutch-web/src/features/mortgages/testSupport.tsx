import { fireEvent, screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { UnsavedChangesProvider } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { ApiError, apiRequest } from '@/lib/api/client'
import type { Mortgage } from '@/lib/api/schemas'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'

// Test-only helpers. The calling test file must `vi.mock('@/lib/api/client', ...)` so apiRequest is a mock.

let counter = 0

export function makeMortgage(overrides: Partial<Mortgage> = {}): Mortgage {
  counter += 1
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    name: `Mortgage ${counter}`,
    startingBalance: 500000,
    numberOfPeriods: 360,
    firstRepaymentDate: '2000-01-01',
    repaymentFrequency: 'Monthly',
    interestRateChanges: [{ newInterestRate: 5.25, effectiveDate: '2000-01-01' }],
    version: 1,
    ...overrides,
  }
}

export function problem(status: number, extra: Record<string, unknown> = {}): ApiError {
  return new ApiError(status, { title: 'Problem', status, ...extra })
}

export const conflictError = () => problem(409, { type: '/problems/mortgage-changed' })

export type FakeServer = {
  mortgages: Mortgage[]
  /** Failures to throw for the next matching request, keyed `GET`, `POST`, `PUT` or `DELETE`. */
  failNext: (method: string, error: unknown) => void
  failAlways: (method: string, error: unknown) => void
  requests: Array<{ method: string; path: string; body?: unknown }>
  /** Hold the next response of a method until released. */
  hold: (method: string) => () => void
}

export function installFakeApi(initial: Mortgage[]): FakeServer {
  const failures = new Map<string, unknown[]>()
  const permanent = new Map<string, unknown>()
  const holds = new Map<string, Promise<void>>()
  const server: FakeServer = {
    mortgages: structuredClone(initial),
    failNext: (method, error) => {
      failures.set(method, [...(failures.get(method) ?? []), error])
    },
    failAlways: (method, error) => {
      permanent.set(method, error)
    },
    requests: [],
    hold: (method) => {
      let release: () => void = () => {}
      holds.set(method, new Promise<void>((resolve) => { release = resolve }))
      return release
    },
  }

  vi.mocked(apiRequest).mockImplementation((async (path: string, _schema: unknown, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined
    server.requests.push({ method, path, body })

    const held = holds.get(method)
    if (held) {
      holds.delete(method)
      await held
    }
    const queued = failures.get(method)
    if (queued && queued.length > 0) {
      throw queued.shift()
    }
    if (permanent.has(method)) {
      throw permanent.get(method)
    }

    const match = /^\/api\/mortgages\/([^?]+)/.exec(path)
    const id = match?.[1]
    if (method === 'GET') {
      return structuredClone(server.mortgages)
    }
    if (method === 'POST') {
      const created = makeMortgage({ ...(body as Partial<Mortgage>), version: 1 })
      server.mortgages.push(created)
      return structuredClone(created)
    }
    const index = server.mortgages.findIndex((mortgage) => mortgage.id === id)
    if (index < 0) {
      throw problem(404)
    }
    const current = server.mortgages[index] as Mortgage
    if (method === 'PUT') {
      if (body?.version !== current.version) {
        throw conflictError()
      }
      const updated = { ...current, ...(body as Partial<Mortgage>), id: current.id, version: current.version + 1 }
      server.mortgages[index] = updated
      return structuredClone(updated)
    }
    const version = Number(new URLSearchParams(path.split('?')[1]).get('version'))
    if (version !== current.version) {
      throw conflictError()
    }
    server.mortgages.splice(index, 1)
    return undefined
  }) as typeof apiRequest)

  return server
}

export function renderWithProviders(ui: ReactElement) {
  return renderWithQueryClient(
    <UnsavedChangesProvider>
      <ToastProvider>{ui}</ToastProvider>
    </UnsavedChangesProvider>,
  )
}

export type FormValues = {
  name?: string
  balance?: string
  periods?: string
  first?: string
  frequency?: string
  /** [rate, date] pairs, filled into new rows. */
  rates?: Array<[string, string]>
}

export function setDate(label: string | RegExp, value: string, index = 0) {
  const fields = screen.getAllByLabelText(label)
  fireEvent.change(fields[index] as HTMLElement, { target: { value } })
}

/** Types into the Loan Details form. Rows are appended after any existing ones. */
export async function fillForm(user: ReturnType<typeof userEvent.setup>, values: FormValues) {
  if (values.name !== undefined) {
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), values.name)
  }
  if (values.balance !== undefined) {
    await user.clear(screen.getByLabelText('Starting Balance'))
    await user.type(screen.getByLabelText('Starting Balance'), values.balance)
  }
  if (values.periods !== undefined) {
    await user.clear(screen.getByLabelText('Number of Periods'))
    await user.type(screen.getByLabelText('Number of Periods'), values.periods)
  }
  if (values.first !== undefined) {
    setDate('First Repayment Date', values.first)
  }
  if (values.frequency !== undefined) {
    await user.selectOptions(screen.getByLabelText('Repayment Frequency'), values.frequency)
  }
  for (const [rate, date] of values.rates ?? []) {
    await user.click(screen.getByRole('button', { name: 'Add interest rate change' }))
    const rateFields = screen.getAllByLabelText('New Interest Rate')
    const dateFields = screen.getAllByLabelText('Effective Date')
    if (rate !== '') {
      await user.type(rateFields[rateFields.length - 1] as HTMLElement, rate)
    }
    setDate('Effective Date', date, dateFields.length - 1)
  }
}

export const validValues: FormValues = {
  name: 'Home loan',
  balance: '500000',
  periods: '360',
  first: '2000-01-01',
  frequency: 'Monthly',
  rates: [['5.25', '2000-01-01']],
}
