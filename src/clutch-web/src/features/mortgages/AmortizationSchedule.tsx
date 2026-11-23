import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '@/components/ui/error-message'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { useActualBalances } from './actualBalances'
import { formatCurrency } from './FormattedNumberField'
import { formatDisplayDate } from './loanDraft'
import { finalRepaymentDate, type PaymentFrequency } from './repaymentDates'
import type { ScheduledPeriod } from './scheduleCalculation'

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
  /** Duration: the saved value, or for an unsaved mortgage the form's value when valid; else undefined. */
  duration?: number
  /** Disbursal Date and Payment Frequency: saved, or the form's valid values for an unsaved mortgage. */
  disbursalDate?: string
  paymentFrequency?: PaymentFrequency
  /** The Mortgage Account selection; with one, a balance column follows Bank Schedule. */
  accountId?: string
  /** The calculated Bank Schedule; absent shows "Not yet calculated". */
  schedule?: ScheduledPeriod[]
}

/** What the schedule table needs to add the account balance column. */
type BalanceColumn = {
  header: string
  loading: boolean
  /** Formatted balance for a 1-based period; '' when blank. */
  cell: (period: number) => string
}

/** The repayment date shown for a period: the disbursal date plus that many intervals (022 FR-001). */
type PeriodDates = { disbursalDate?: string; paymentFrequency?: PaymentFrequency }

/**
 * Read-only schedule: periods 1 to Duration, each dated on its repayment, rendered through a window so any
 * Duration stays usable.
 */
export function AmortizationSchedule(props: AmortizationScheduleProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {props.accountId === undefined
        ? <PlainSchedule {...props} />
        : <AccountSchedule {...props} accountId={props.accountId} />}
    </div>
  )
}

function PlainSchedule({
  duration,
  disbursalDate,
  paymentFrequency,
  schedule,
}: PeriodDates & { duration?: number, schedule?: ScheduledPeriod[] }) {
  return duration === undefined
    ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
    : (
        <ScheduleTable
          disbursalDate={disbursalDate}
          paymentFrequency={paymentFrequency}
          rowCount={duration}
          schedule={schedule}
        />
      )
}

function AccountSchedule({
  accountId,
  duration,
  disbursalDate,
  paymentFrequency,
  schedule,
}: AmortizationScheduleProps & { accountId: string }) {
  const actual = useActualBalances(accountId, { duration, disbursalDate, paymentFrequency })
  const complete = duration !== undefined && disbursalDate !== undefined && paymentFrequency !== undefined

  if (actual.status === 'none') {
    return (
      <PlainSchedule
        disbursalDate={disbursalDate}
        duration={duration}
        paymentFrequency={paymentFrequency}
        schedule={schedule}
      />
    )
  }

  const loading = actual.status === 'loading'
  const failed = actual.status === 'failed'
  const column: BalanceColumn = {
    header: 'Actual Balance',
    loading,
    cell: (period) => {
      const value = actual.balances[period - 1]
      return value === null || value === undefined
        ? ''
        : formatCurrencyAmount(value, actual.currencyCode ?? '')
    },
  }

  // Details complete: the mortgage's own rows. Incomplete (new, unsaved): monthly rows from the account.
  const rowCount = complete ? duration : (actual.periodCount ?? 0)
  return (
    <>
      {failed && <ErrorMessage>{BALANCES_FAILED_MESSAGE}</ErrorMessage>}
      {!complete && !loading && rowCount === 0
        ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
        : (
            <ScheduleTable
              balanceColumn={column}
              calculated={complete}
              disbursalDate={disbursalDate}
              paymentFrequency={paymentFrequency}
              rowCount={rowCount}
              schedule={schedule}
            />
          )}
    </>
  )
}

type ScheduleTableProps = PeriodDates & {
  rowCount: number
  balanceColumn?: BalanceColumn
  /** False for the fallback view: only Period and the balance are filled. */
  calculated?: boolean
  schedule?: ScheduledPeriod[]
}

/** 49950225 cents -> "$499,502.25". */
function closingBalance(period: ScheduledPeriod): string {
  const whole = Math.floor(period.closingCents / 100)
  const cents = String(period.closingCents % 100).padStart(2, '0')
  return formatCurrency(`${whole}.${cents}`)
}

/** "29 Dec 2023" for period k, or '' without a disbursal date and frequency or past 31 Dec 9999. */
function periodDate(period: number, { disbursalDate, paymentFrequency }: PeriodDates): string {
  if (disbursalDate === undefined || paymentFrequency === undefined) {
    return ''
  }
  const date = finalRepaymentDate(disbursalDate, period, paymentFrequency)
  return date === null ? '' : formatDisplayDate(date)
}

function ScheduleTable({
  rowCount,
  balanceColumn,
  calculated = true,
  schedule,
  disbursalDate,
  paymentFrequency,
}: ScheduleTableProps) {
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

  // The calculated closing balance; "Not yet calculated" without a schedule; blank in the fallback view.
  function bankScheduleCell(period: number): string {
    const scheduled = calculated ? schedule?.[period - 1] : undefined
    if (scheduled) {
      return closingBalance(scheduled)
    }
    return calculated ? NOT_CALCULATED : ''
  }

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
              <div className="flex items-center px-3" role="cell">
                {calculated ? periodDate(period, { disbursalDate, paymentFrequency }) : ''}
              </div>
              <div
                className={`flex items-center justify-end px-3 text-right tabular-nums ${bankScheduleCell(period) === NOT_CALCULATED ? 'text-fg-secondary' : ''}`}
                role="cell"
              >
                {bankScheduleCell(period)}
              </div>
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
