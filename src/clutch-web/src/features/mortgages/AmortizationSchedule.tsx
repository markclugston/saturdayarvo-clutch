import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '@/components/ui/error-message'
import { getAccounts } from '@/features/accounts/api'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { usePeriodBalances, type PeriodBalanceRequest } from './api'
import type { PaymentFrequency } from './repaymentDates'

function findScrollParent(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = window.getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
  }
  return null
}

export const ENTER_DETAILS_MESSAGE = 'Please enter your mortgage details'
export const NOT_CALCULATED = 'Not yet calculated'

export const BALANCES_FAILED_MESSAGE = 'The account balances could not be loaded.'

const ROW_HEIGHT = 40
const FALLBACK_VIEWPORT_HEIGHT = 384
const OVERSCAN = 8

type AmortizationScheduleProps = {
  /** Saved Duration of the selected mortgage; undefined for a new, unsaved one. */
  duration?: number
  /** Saved Drawdown Date and Payment Frequency; undefined for a new, unsaved mortgage. */
  drawdownDate?: string
  paymentFrequency?: PaymentFrequency
  /** The Mortgage Account selection; with one, a balance column follows Bank Schedule. */
  accountId?: string
}

/** What the schedule table needs to add the account balance column. */
type BalanceColumn = {
  header: string
  loading: boolean
  /** Formatted balance for a 1-based period; '' when blank. */
  cell: (period: number) => string
}

/** Read-only placeholder schedule: periods 1 to N + 1, rendered through a window so any N stays usable. */
export function AmortizationSchedule(props: AmortizationScheduleProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {props.accountId === undefined
        ? <PlainSchedule duration={props.duration} />
        : <AccountSchedule {...props} accountId={props.accountId} />}
    </div>
  )
}

function PlainSchedule({ duration }: { duration?: number }) {
  return duration === undefined
    ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
    : <ScheduleTable rowCount={duration + 1} />
}

function AccountSchedule({
  accountId,
  duration,
  drawdownDate,
  paymentFrequency,
}: AmortizationScheduleProps & { accountId: string }) {
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  // An account missing from the list (deleted elsewhere) behaves as none.
  const account = accountsQuery.data?.find((item) => item.id === accountId)
  const complete = duration !== undefined && drawdownDate !== undefined && paymentFrequency !== undefined
  const request: PeriodBalanceRequest | null = account
    ? {
        accountId,
        schedule: complete
          ? { drawdownDate, frequency: paymentFrequency, duration }
          : undefined,
      }
    : null
  const balances = usePeriodBalances(request)

  if (!account) {
    return <PlainSchedule duration={duration} />
  }

  const loading = balances.isPending
  const failed = balances.isError
  const values = balances.data?.balances ?? []
  const column: BalanceColumn = {
    header: `${account.description} Balance`,
    loading,
    cell: (period) => {
      const value = values[period - 1]
      return value === null || value === undefined
        ? ''
        : formatCurrencyAmount(value, balances.data?.currencyCode ?? account.currencyCode)
    },
  }

  // Details complete: the mortgage's own rows. Incomplete (new, unsaved): monthly rows from the account.
  const rowCount = complete ? duration + 1 : (balances.data?.periodCount ?? 0)
  return (
    <>
      {failed && <ErrorMessage>{BALANCES_FAILED_MESSAGE}</ErrorMessage>}
      {!complete && !loading && rowCount === 0
        ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
        : <ScheduleTable balanceColumn={column} calculated={complete} rowCount={rowCount} />}
    </>
  )
}

type ScheduleTableProps = {
  rowCount: number
  balanceColumn?: BalanceColumn
  /** False for the fallback view: only Period and the balance are filled. */
  calculated?: boolean
}

function ScheduleTable({ rowCount, balanceColumn, calculated = true }: ScheduleTableProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT_HEIGHT)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // The page's content area scrolls, not this group: window the rows against that scroller.
  useEffect(() => {
    const wrapper = wrapperRef.current
    const scroller = wrapper ? findScrollParent(wrapper) : null
    if (!wrapper || !scroller) {
      return undefined
    }
    function measure() {
      if (!wrapper || !scroller) {
        return
      }
      const wrapperTop = wrapper.getBoundingClientRect().top
      const scrollerTop = scroller.getBoundingClientRect().top
      setScrollTop(Math.max(0, scrollerTop - wrapperTop))
      if (scroller.clientHeight > 0) {
        setViewportHeight(scroller.clientHeight)
      }
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])

  const columns = balanceColumn ? 'grid-cols-[5rem_1fr_1fr_1fr]' : 'grid-cols-[5rem_1fr_1fr]'
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const periods: number[] = []
  for (let index = first; index < last; index += 1) {
    periods.push(index + 1)
  }

  return (
    <div className="min-w-0 flex-1" ref={wrapperRef}>
      <div
        aria-busy={balanceColumn?.loading ? true : undefined}
        aria-rowcount={rowCount + 1}
        className="min-w-80 text-sm"
        role="table"
      >
        {balanceColumn?.loading && <p className="sr-only" role="status">Loading account balances</p>}
        <div
          aria-rowindex={1}
          className={`sticky top-0 z-10 grid ${columns} bg-card font-semibold`}
          role="row"
          style={{ height: ROW_HEIGHT }}
        >
          <div className="flex items-center justify-end px-3 text-right" role="columnheader">Period</div>
          <div className="flex items-center px-3" role="columnheader">Date</div>
          <div className="flex items-center justify-end px-3 text-right" role="columnheader">Bank Schedule</div>
          {balanceColumn && (
            <div className="flex items-center justify-end px-3 text-right" role="columnheader">{balanceColumn.header}</div>
          )}
        </div>
        <div role="rowgroup">
          <div aria-hidden="true" role="presentation" style={{ height: first * ROW_HEIGHT }} />
          {periods.map((period) => (
            <div
              aria-rowindex={period + 1}
              className={`grid ${columns} odd:bg-raised`}
              key={period}
              role="row"
              style={{ height: ROW_HEIGHT }}
            >
              <div className="flex items-center justify-end px-3 text-right tabular-nums" role="cell">{period}</div>
              <div className="flex items-center px-3 text-fg-secondary" role="cell">{calculated ? NOT_CALCULATED : ''}</div>
              <div className="flex items-center justify-end px-3 text-right text-fg-secondary tabular-nums" role="cell">{calculated ? NOT_CALCULATED : ''}</div>
              {balanceColumn && (
                <div className="flex items-center justify-end px-3 text-right tabular-nums" role="cell">{balanceColumn.cell(period)}</div>
              )}
            </div>
          ))}
          <div aria-hidden="true" role="presentation" style={{ height: (rowCount - last) * ROW_HEIGHT }} />
        </div>
      </div>
    </div>
  )
}
