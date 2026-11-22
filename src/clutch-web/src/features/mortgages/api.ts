import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ApiError, apiRequest } from '@/lib/api/client'
import {
  MortgageListSchema,
  MortgageResponseSchema,
  PeriodBalancesSchema,
  type Mortgage,
  type MortgageInput,
} from '@/lib/api/schemas'

export const mortgagesQueryKey = ['mortgages'] as const

/** The session ended (401). Not a load failure: the screen returns to sign-in or asks the user. */
export class MortgageUnauthorizedError extends Error {
  constructor() {
    super('Your sign-in has expired.')
    this.name = 'MortgageUnauthorizedError'
  }
}

/** The mortgage no longer exists for this user (404). */
export class MortgageGoneError extends Error {
  constructor() {
    super('This mortgage was deleted elsewhere')
    this.name = 'MortgageGoneError'
  }
}

/** The mortgage changed since it was loaded (409). */
export class MortgageChangedError extends Error {
  constructor() {
    super('This mortgage was changed elsewhere; reload to see the latest')
    this.name = 'MortgageChangedError'
  }
}

/** 400 with messages keyed by field path (e.g. `interestRateChanges[1].effectiveDate`). */
export class MortgageValidationError extends Error {
  readonly fieldErrors: Record<string, string>

  constructor(fieldErrors: Record<string, string>) {
    super('The mortgage is invalid.')
    this.name = 'MortgageValidationError'
    this.fieldErrors = fieldErrors
  }
}

function translate(error: unknown): unknown {
  if (!(error instanceof ApiError)) {
    return error
  }
  if (error.status === 401) {
    return new MortgageUnauthorizedError()
  }
  if (error.status === 404) {
    return new MortgageGoneError()
  }
  if (error.status === 409 && error.problem.type?.endsWith('/mortgage-changed')) {
    return new MortgageChangedError()
  }
  if (error.status === 400 && error.problem.errors) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, messages] of Object.entries(error.problem.errors)) {
      const first = messages[0]
      if (first) {
        fieldErrors[key] = first
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return new MortgageValidationError(fieldErrors)
    }
  }
  return error
}

async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw translate(error)
  }
}

export function listMortgages(): Promise<Mortgage[]> {
  return request(() => apiRequest('/api/mortgages', MortgageListSchema))
}

export function createMortgage(input: MortgageInput): Promise<Mortgage> {
  return request(() => apiRequest('/api/mortgages', MortgageResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  }))
}

export function updateMortgage(id: string, version: number, input: MortgageInput): Promise<Mortgage> {
  return request(() => apiRequest(`/api/mortgages/${encodeURIComponent(id)}`, MortgageResponseSchema, {
    method: 'PUT',
    body: JSON.stringify({ ...input, version }),
  }))
}

export function deleteMortgage(id: string, version: number): Promise<void> {
  return request(() => apiRequest(
    `/api/mortgages/${encodeURIComponent(id)}?version=${version}`,
    z.undefined(),
    { method: 'DELETE' },
  ))
}

export const periodBalancesQueryKey = ['mortgage-period-balances'] as const

export type PeriodBalanceRequest = {
  accountId: string
  /** All three, or none (monthly fallback from the account's history). */
  schedule?: { drawdownDate: string; frequency: string; duration: number }
}

export function getPeriodBalances({ accountId, schedule }: PeriodBalanceRequest) {
  const params = new URLSearchParams({ accountId })
  if (schedule) {
    params.set('drawdownDate', schedule.drawdownDate)
    params.set('frequency', schedule.frequency)
    params.set('duration', String(schedule.duration))
  }
  return apiRequest(`/api/mortgages/period-balances?${params.toString()}`, PeriodBalancesSchema)
}

export function usePeriodBalances(request: PeriodBalanceRequest | null) {
  return useQuery({
    queryKey: [...periodBalancesQueryKey, request?.accountId, request?.schedule ?? null],
    queryFn: () => getPeriodBalances(request as PeriodBalanceRequest),
    enabled: request !== null,
  })
}

export function useMortgages() {
  return useQuery({ queryKey: mortgagesQueryKey, queryFn: listMortgages })
}
