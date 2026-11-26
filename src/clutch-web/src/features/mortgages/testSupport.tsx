import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { expect, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { UnsavedChangesProvider } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { ApiError, apiRequest } from '@/lib/api/client'
import type { Account, LoanPayoffTimelineView, Mortgage, PeriodBalances } from '@/lib/api/schemas'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'

// Test-only helpers. The calling test file must `vi.mock('@/lib/api/client', ...)` so apiRequest is a mock.

let counter = 0

export function makeMortgage(overrides: Partial<Mortgage> = {}): Mortgage {
  counter += 1
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    name: `Mortgage ${counter}`,
    openingBalance: 500000,
    duration: 360,
    disbursalDate: '2000-01-01',
    paymentFrequency: 'Monthly',
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
  /** Accounts returned by `GET /api/accounts`. */
  accounts: Account[]
  /** Error thrown by `GET /api/accounts` while set. */
  accountsError?: unknown
  /** Response of `GET /api/mortgages/period-balances`. */
  balances: PeriodBalances
  /** Error thrown by the balances request while set. */
  balancesError?: unknown
  /** Hold the next balances response until released. */
  holdBalances: () => () => void
  /** Query strings of the balances requests, as received. */
  balanceRequests: string[]
  /** Failures to throw for the next matching request, keyed `GET`, `POST`, `PUT` or `DELETE`. */
  failNext: (method: string, error: unknown) => void
  failAlways: (method: string, error: unknown) => void
  requests: Array<{ method: string; path: string; body?: unknown }>
  /** Hold the next response of a method until released. */
  hold: (method: string) => () => void
  /** The stored Amortization Schedule view. */
  view: LoanPayoffTimelineView
  /** Amortization Schedule preference requests, kept apart from the mortgage requests. */
  preferenceRequests: Array<{ method: string; body?: unknown; signal?: AbortSignal | null }>
  /** Hold the next preference response of a method until released (or aborted). */
  holdPreference: (method: string) => () => void
  /** Hold every preference response of a method; returns one release per held request. */
  holdAllPreference: (method: string) => Array<() => void>
  failPreference: (method: string, error: unknown) => void
}

const PREFERENCE_PATH = '/api/preferences/loan-payoff-timeline'

export function installFakeApi(initial: Mortgage[], view: LoanPayoffTimelineView = 'Burndown'): FakeServer {
  const failures = new Map<string, unknown[]>()
  const permanent = new Map<string, unknown>()
  const holds = new Map<string, Promise<void>>()
  const preferenceHolds = new Map<string, Promise<void>>()
  const preferenceHoldAll = new Map<string, Array<() => void>>()
  const preferenceFailures = new Map<string, unknown[]>()
  let balanceHold: Promise<void> | null = null
  const server: FakeServer = {
    view,
    preferenceRequests: [],
    holdPreference: (method) => {
      let release: () => void = () => {}
      preferenceHolds.set(method, new Promise<void>((resolve) => { release = resolve }))
      return release
    },
    holdAllPreference: (method) => {
      const releases: Array<() => void> = []
      preferenceHoldAll.set(method, releases)
      return releases
    },
    failPreference: (method, error) => {
      preferenceFailures.set(method, [...(preferenceFailures.get(method) ?? []), error])
    },
    mortgages: structuredClone(initial),
    accounts: [],
    balances: { currencyCode: 'AUD', periodCount: 0, balances: [] },
    balanceRequests: [],
    holdBalances: () => {
      let release: () => void = () => {}
      balanceHold = new Promise<void>((resolve) => { release = resolve })
      return release
    },
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
    if (path === PREFERENCE_PATH) {
      return handlePreference(method, body, init?.signal)
    }
    if (path === '/api/accounts') {
      if (server.accountsError) {
        throw server.accountsError
      }
      return structuredClone(server.accounts)
    }
    if (path.startsWith('/api/mortgages/period-balances')) {
      server.balanceRequests.push(path.split('?')[1] ?? '')
      if (balanceHold) {
        const held = balanceHold
        balanceHold = null
        await held
      }
      if (server.balancesError) {
        throw server.balancesError
      }
      return structuredClone(server.balances)
    }
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

  async function handlePreference(
    method: string,
    body: Record<string, unknown> | undefined,
    signal: AbortSignal | null | undefined,
  ) {
    server.preferenceRequests.push({ method, body, signal })
    const releases = preferenceHoldAll.get(method)
    const held = releases
      ? new Promise<void>((resolve) => { releases.push(resolve) })
      : preferenceHolds.get(method)
    preferenceHolds.delete(method)
    if (held) {
      await new Promise<void>((resolve, reject) => {
        void held.then(resolve)
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    }
    const queued = preferenceFailures.get(method)
    if (queued && queued.length > 0) {
      throw queued.shift()
    }
    if (method === 'PUT') {
      server.view = body?.view as LoanPayoffTimelineView
    }
    return { view: server.view }
  }

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
  /** [rate, date] pairs, added through the Interest Rates dialog. */
  rates?: Array<[string, string]>
}

export function setDate(label: string | RegExp, value: string, index = 0) {
  const fields = screen.getAllByLabelText(label)
  fireEvent.change(fields[index] as HTMLElement, { target: { value } })
}

/** Types into the Details form. Rates are added after any existing ones. */
export async function fillForm(user: ReturnType<typeof userEvent.setup>, values: FormValues) {
  if (values.name !== undefined) {
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), values.name)
  }
  if (values.balance !== undefined) {
    await user.clear(screen.getByLabelText('Opening Balance'))
    await user.type(screen.getByLabelText('Opening Balance'), values.balance)
  }
  if (values.periods !== undefined) {
    await user.clear(screen.getByLabelText('Duration'))
    await user.type(screen.getByLabelText('Duration'), values.periods)
  }
  if (values.first !== undefined) {
    setDate('Disbursal Date', values.first)
  }
  if (values.frequency !== undefined) {
    await user.selectOptions(screen.getByLabelText('Payment Frequency'), values.frequency)
  }
  if (values.rates && values.rates.length > 0) {
    await addRates(user, values.rates)
  }
}

/** Opens "Interest Rates", adds each [rate, date] pair, then closes the dialog. */
export async function addRates(user: ReturnType<typeof userEvent.setup>, rates: Array<[string, string]>) {
  await user.click(screen.getByRole('button', { name: 'Interest Rates' }))
  const dialog = await screen.findByRole('dialog', { name: 'Interest Rates' })
  for (const [rate, date] of rates) {
    const rateField = within(dialog).getByLabelText('New Interest Rate')
    await user.clear(rateField)
    if (rate !== '') {
      await user.type(rateField, rate)
    }
    const dateField = within(dialog).getByLabelText('Effective Date')
    // The opening rate's date is the Disbursal Date, prefilled and disabled.
    if (!(dateField as HTMLInputElement).disabled) {
      fireEvent.change(dateField, { target: { value: date } })
    }
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
  }
  await user.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

/** The "{rate} {date}" text of each listed change in the open dialog, in list order. */
export function listedRates(): string[] {
  const list = within(screen.getByRole('dialog')).queryByRole('list', { name: 'Interest Rate Changes' })
  return list
    ? within(list).getAllByRole('listitem').map((item) => {
      const remove = within(item).getByRole('button', { name: /^Remove / })
      return (remove.getAttribute('aria-label') ?? '').replace(/^Remove /, '').replace(' from ', ' ')
    })
    : []
}

export const validValues: FormValues = {
  name: 'Home loan',
  balance: '500000',
  periods: '360',
  first: '2000-01-01',
  frequency: 'Monthly',
  rates: [['5.25', '2000-01-01']],
}
