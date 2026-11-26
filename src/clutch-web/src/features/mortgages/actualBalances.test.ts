import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/lib/api/client'
import { balancePoints, useActualBalances } from './actualBalances'
import type { ScheduledPeriod } from './scheduleCalculation'
import { installFakeApi, type FakeServer } from './testSupport'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
}))

const schedule: ScheduledPeriod[] = [
  { date: '2026-02-01', closingCents: 99000 },
  { date: '2026-03-01', closingCents: 98000 },
  { date: '2026-04-01', closingCents: 97000 },
  { date: '2026-05-01', closingCents: 0 },
] as ScheduledPeriod[]

describe('balancePoints', () => {
  it('skips blank cells and dates each point from its schedule row', () => {
    expect(balancePoints([null, '980.00', null, '10.50'], schedule)).toEqual([
      { date: '2026-03-01', amount: '980.00', value: 980 },
      { date: '2026-05-01', amount: '10.50', value: 10.5 },
    ])
  })

  it('never adds a point at the Disbursal Date', () => {
    const points = balancePoints(['1000.00'], schedule)

    expect(points).toHaveLength(1)
    expect(points[0]?.date).toBe('2026-02-01')
  })

  it('ignores trailing blanks and balances past the schedule', () => {
    expect(balancePoints(['1.00', null, null, null], schedule)).toHaveLength(1)
    expect(balancePoints(['1', '2', '3', '4', '5', '6'], schedule)).toHaveLength(4)
    expect(balancePoints([], schedule)).toEqual([])
  })

  it('passes negative and large values through unchanged', () => {
    expect(balancePoints(['-250.75', '99999999.99'], schedule)).toEqual([
      { date: '2026-02-01', amount: '-250.75', value: -250.75 },
      { date: '2026-03-01', amount: '99999999.99', value: 99999999.99 },
    ])
  })
})

describe('useActualBalances', () => {
  const account = { id: '11111111-1111-4111-8111-111111111111', description: 'Offset Account', currencyCode: 'NZD' }
  const params = { duration: 3, disbursalDate: '2026-01-01', paymentFrequency: 'Monthly' as const }
  let server: FakeServer

  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return createElement(QueryClientProvider, { client }, children)
  }

  beforeEach(() => {
    vi.resetAllMocks()
    server = installFakeApi([])
    server.accounts = [account]
  })

  it('is none without an account and requests nothing', async () => {
    const { result } = renderHook(() => useActualBalances(undefined, params), { wrapper })

    expect(result.current.status).toBe('none')
    expect(result.current.balances).toEqual([])
    await Promise.resolve()
    expect(server.balanceRequests).toHaveLength(0)
    expect(vi.mocked(apiRequest)).not.toHaveBeenCalledWith(expect.stringContaining('period-balances'), expect.anything(), expect.anything())
  })

  it('is none when the account is missing from the accounts list', async () => {
    server.accounts = []
    const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/api/accounts', expect.anything()))
    expect(result.current.status).toBe('none')
    expect(server.balanceRequests).toHaveLength(0)
  })

  it('is loading, then ready with the balances and the response currency', async () => {
    server.balances = { currencyCode: 'AUD', periodCount: 3, balances: [null, '980.00'] }
    const release = server.holdBalances()
    const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('loading'))
    release()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.balances).toEqual([null, '980.00'])
    expect(result.current.currencyCode).toBe('AUD')
    expect(result.current.periodCount).toBe(3)
  })

  it('is failed when the request fails', async () => {
    server.balancesError = new Error('boom')
    const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.balances).toEqual([])
  })

  it('falls back to the account currency while the response is not available', async () => {
    const release = server.holdBalances()
    const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('loading'))
    expect(result.current.currencyCode).toBe('NZD')
    release()
  })

  it('sends the same request as the table: account, disbursal date, frequency and duration', async () => {
    renderHook(() => useActualBalances(account.id, params), { wrapper })

    await waitFor(() => expect(server.balanceRequests).toHaveLength(1))
    const query = new URLSearchParams(server.balanceRequests[0])
    expect(query.get('accountId')).toBe(account.id)
    expect(query.get('disbursalDate')).toBe('2026-01-01')
    expect(query.get('frequency')).toBe('Monthly')
    expect(query.get('duration')).toBe('3')
  })

  it('sends only the account when the details are incomplete (monthly fallback)', async () => {
    renderHook(() => useActualBalances(account.id, { duration: undefined }), { wrapper })

    await waitFor(() => expect(server.balanceRequests).toHaveLength(1))
    expect(new URLSearchParams(server.balanceRequests[0]).has('duration')).toBe(false)
  })

  describe('forecast', () => {
    beforeEach(() => {
      server.balances = { currencyCode: 'AUD', periodCount: 3, balances: ['1000.00', '900.00'] }
    })

    it('projects the balances once ready', async () => {
      const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.forecast).toEqual([null, null, '800.00'])
    })

    it('is empty without an account', () => {
      const { result } = renderHook(() => useActualBalances(undefined, params), { wrapper })

      expect(result.current.forecast).toEqual([])
    })

    it('is empty while loading', async () => {
      const release = server.holdBalances()
      const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('loading'))
      expect(result.current.forecast).toEqual([])
      release()
    })

    it('is empty when the request fails', async () => {
      server.balancesError = new Error('boom')
      const { result } = renderHook(() => useActualBalances(account.id, params), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('failed'))
      expect(result.current.forecast).toEqual([])
    })

    it.each([
      ['Duration', { ...params, duration: undefined }],
      ['Disbursal Date', { ...params, disbursalDate: undefined }],
      ['Payment Frequency', { ...params, paymentFrequency: undefined }],
    ])('is empty without a %s', async (_, incomplete) => {
      const { result } = renderHook(() => useActualBalances(account.id, incomplete), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.forecast).toEqual([])
    })
  })
})
