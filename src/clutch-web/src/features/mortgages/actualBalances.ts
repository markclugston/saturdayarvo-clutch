import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getAccounts } from '@/features/accounts/api'
import { usePeriodBalances, type PeriodBalanceRequest } from './api'
import { forecastBalances } from './forecastBalances'
import type { PaymentFrequency } from './repaymentDates'
import type { ScheduledPeriod } from './scheduleCalculation'

/** One plotted Actual or Forecast Balance: a non-blank balance at its schedule row's date. */
export type BalancePoint = {
  /** yyyy-MM-dd of the schedule row. */
  date: string
  /** The balance as the server sent it; formatted for text. */
  amount: string
  /** The balance in dollars; positions the point. */
  value: number
}

/** One point per non-blank balance that has a schedule row; never one at the Disbursal Date. */
export function balancePoints(
  balances: readonly (string | null | undefined)[],
  schedule: readonly ScheduledPeriod[],
): BalancePoint[] {
  const points: BalancePoint[] = []
  for (let index = 0; index < balances.length; index += 1) {
    const amount = balances[index]
    const period = schedule[index]
    if (amount !== null && amount !== undefined && period) {
      points.push({ date: period.date, amount, value: Number(amount) })
    }
  }
  return points
}

export type ActualBalances = {
  /** `none`: no account selected, or the account is missing from the accounts list. */
  status: 'none' | 'loading' | 'failed' | 'ready'
  /** Index i is period i + 1; null or missing is a blank cell. Empty unless ready. */
  balances: (string | null)[]
  /** Forecast Balance cells, indexed like `balances`. Empty unless ready with complete Details. */
  forecast: (string | null)[]
  currencyCode?: string
  /** Monthly fallback row count (the table only). */
  periodCount?: number
  /** Loads the balances again after a failure. */
  retry: () => void
}

type ScheduleParams = {
  duration?: number
  disbursalDate?: string
  paymentFrequency?: PaymentFrequency
}

/** The Mortgage Account's balances through the request the schedule table uses, so both views share one query. */
export function useActualBalances(accountId: string | undefined, params: ScheduleParams): ActualBalances {
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  // An account missing from the list (deleted elsewhere) behaves as none.
  const account = accountId === undefined ? undefined : accountsQuery.data?.find((item) => item.id === accountId)
  const { duration, disbursalDate, paymentFrequency } = params
  const complete = duration !== undefined && disbursalDate !== undefined && paymentFrequency !== undefined
  const request: PeriodBalanceRequest | null = account && accountId !== undefined
    ? {
        accountId,
        schedule: complete ? { disbursalDate, frequency: paymentFrequency, duration } : undefined,
      }
    : null
  const balances = usePeriodBalances(request)
  const values = balances.data?.balances
  // Both views read this one calculation, so they cannot disagree.
  const forecast = useMemo(
    () => values === undefined || duration === undefined || disbursalDate === undefined || paymentFrequency === undefined
      ? []
      : forecastBalances(values, paymentFrequency, duration),
    [values, duration, disbursalDate, paymentFrequency],
  )

  const retry = () => void balances.refetch()

  if (!account) {
    return { status: 'none', balances: [], forecast: [], retry }
  }
  if (balances.isPending) {
    return { status: 'loading', balances: [], forecast: [], currencyCode: account.currencyCode, retry }
  }
  if (balances.isError) {
    return { status: 'failed', balances: [], forecast: [], currencyCode: account.currencyCode, retry }
  }
  return {
    retry,
    status: 'ready',
    balances: balances.data.balances,
    forecast,
    currencyCode: balances.data.currencyCode,
    periodCount: balances.data.periodCount,
  }
}
