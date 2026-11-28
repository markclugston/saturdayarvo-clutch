import { useEffect, useRef, useState, type Ref } from 'react'
import {
  ListBody, ListCell, ListHead, ListHeaderCell, ListLoadError, ListLoading, ListRegion, ListRow, ListTable,
} from '@/components/ui/list'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { cn } from '@/lib/utils'
import { useActualBalances } from './actualBalances'
import { formatCents } from './formatCents'
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
/** Two lines of text fit a row, so a narrow column wraps without making its row taller. */
const CELL = 'whitespace-normal py-0 leading-tight'
const FALLBACK_VIEWPORT_HEIGHT = 384
const OVERSCAN = 8

type AmortizationScheduleProps = {
  /** Duration: the saved value, or for an unsaved mortgage the form's value when valid; else undefined. */
  duration?: number
  /** Disbursal Date and Payment Frequency: saved, or the form's valid values for an unsaved mortgage. */
  disbursalDate?: string
  paymentFrequency?: PaymentFrequency
  /** The Mortgage Account selection; with one, the balance columns follow Bank Schedule. */
  accountId?: string
  /** The calculated Bank Schedule; absent shows "Not yet calculated". */
  schedule?: ScheduledPeriod[]
  /** Receives the element that scrolls the rows, so the card around it can be stopped (`usePinnedList`). */
  listRef?: Ref<HTMLDivElement>
}

/** What the schedule table needs to add the account balance columns. */
type BalanceColumns = {
  loading: boolean
  columns: {
    header: string
    /** Formatted balance for a 1-based period; '' when blank. */
    cell: (period: number) => string
  }[]
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
  listRef,
}: Pick<AmortizationScheduleProps, 'duration' | 'disbursalDate' | 'paymentFrequency' | 'schedule' | 'listRef'>) {
  return duration === undefined
    ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
    : (
        <ScheduleTable
          disbursalDate={disbursalDate}
          listRef={listRef}
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
  listRef,
}: AmortizationScheduleProps & { accountId: string }) {
  const actual = useActualBalances(accountId, { duration, disbursalDate, paymentFrequency })
  const complete = duration !== undefined && disbursalDate !== undefined && paymentFrequency !== undefined

  if (actual.status === 'none') {
    return (
      <PlainSchedule
        disbursalDate={disbursalDate}
        duration={duration}
        listRef={listRef}
        paymentFrequency={paymentFrequency}
        schedule={schedule}
      />
    )
  }

  const loading = actual.status === 'loading'
  const failed = actual.status === 'failed'
  const cells = (values: (string | null)[]) => (period: number) => {
    const value = values[period - 1]
    return value === null || value === undefined
      ? ''
      : formatCurrencyAmount(value, actual.currencyCode ?? '')
  }
  const balanceColumns: BalanceColumns = {
    loading,
    columns: [
      { header: 'Actual Balance', cell: cells(actual.balances) },
      { header: 'Forecast Balance', cell: cells(actual.forecast) },
    ],
  }

  // Details complete: the mortgage's own rows. Incomplete (new, unsaved): monthly rows from the account.
  const rowCount = complete ? duration : (actual.periodCount ?? 0)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {loading && <ListLoading>Loading account balances…</ListLoading>}
      {failed && <ListLoadError onRetry={actual.retry}>{BALANCES_FAILED_MESSAGE}</ListLoadError>}
      {!complete && !loading && rowCount === 0
        ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
        : (
            <ScheduleTable
              balanceColumns={balanceColumns}
              calculated={complete}
              disbursalDate={disbursalDate}
              listRef={listRef}
              paymentFrequency={paymentFrequency}
              rowCount={rowCount}
              schedule={schedule}
            />
          )}
    </div>
  )
}

type ScheduleTableProps = PeriodDates & {
  rowCount: number
  balanceColumns?: BalanceColumns
  /** False for the fallback view: only Period and the balances are filled. */
  calculated?: boolean
  schedule?: ScheduledPeriod[]
  listRef?: Ref<HTMLDivElement>
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
  balanceColumns,
  calculated = true,
  schedule,
  disbursalDate,
  paymentFrequency,
  listRef,
}: ScheduleTableProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT_HEIGHT)
  const tableRef = useRef<HTMLTableElement>(null)

  // Rows pass out of sight above the page's content area, or above their own list once the card is
  // stopped and the list scrolls: window them against whichever edge is lower.
  useEffect(() => {
    const table = tableRef.current
    const list = table?.parentElement
    const scroller = list ? findScrollParent(list) : null
    if (!table || !list || !scroller) {
      return undefined
    }
    function measure() {
      if (!table || !list || !scroller) {
        return
      }
      const visibleTop = Math.max(scroller.getBoundingClientRect().top, list.getBoundingClientRect().top)
      setScrollTop(Math.max(0, visibleTop - table.getBoundingClientRect().top))
      if (scroller.clientHeight > 0) {
        setViewportHeight(scroller.clientHeight)
      }
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    list.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      list.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])

  // The calculated closing balance; "Not yet calculated" without a schedule; blank in the fallback view.
  function bankScheduleCell(period: number): string {
    const scheduled = calculated ? schedule?.[period - 1] : undefined
    if (scheduled) {
      return formatCents(scheduled.closingCents)
    }
    return calculated ? NOT_CALCULATED : ''
  }

  const columnCount = 3 + (balanceColumns?.columns.length ?? 0)
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const periods: number[] = []
  for (let index = first; index < last; index += 1) {
    periods.push(index + 1)
  }

  return (
    // No scroll anchoring (`page`): swapping rows for spacer height keeps the total height, and the browser's
    // anchor adjustment would move the scroller itself, which renders new rows and moves it again.
    <ListRegion className="min-w-0" label="Schedule Rows" ref={listRef} scroll="page">
      <ListTable
        aria-busy={balanceColumns?.loading ? true : undefined}
        aria-rowcount={rowCount + 1}
        caption="Repayment schedule by period"
        // Fixed, so the columns do not move as other rows are drawn.
        className={cn('table-fixed', balanceColumns ? 'min-w-140' : 'min-w-80')}
        ref={tableRef}
      >
        <colgroup>
          <col className="w-20" />
        </colgroup>
        <ListHead>
          <tr aria-rowindex={1} style={{ height: ROW_HEIGHT }}>
            <ListHeaderCell className={CELL} numeric>Period</ListHeaderCell>
            <ListHeaderCell className={CELL}>Date</ListHeaderCell>
            <ListHeaderCell className={CELL} numeric>Bank Schedule</ListHeaderCell>
            {balanceColumns?.columns.map(({ header }) => (
              <ListHeaderCell className={CELL} key={header} numeric>{header}</ListHeaderCell>
            ))}
          </tr>
        </ListHead>
        <ListBody>
          <Spacer columns={columnCount} height={first * ROW_HEIGHT} />
          {periods.map((period) => (
            <ListRow aria-rowindex={period + 1} key={period} style={{ height: ROW_HEIGHT }}>
              <ListCell className={CELL} numeric>{period}</ListCell>
              <ListCell className={CELL}>
                {calculated ? periodDate(period, { disbursalDate, paymentFrequency }) : ''}
              </ListCell>
              <ListCell
                className={cn(CELL, bankScheduleCell(period) === NOT_CALCULATED && 'text-fg-secondary')}
                numeric
              >
                {bankScheduleCell(period)}
              </ListCell>
              {balanceColumns?.columns.map(({ header, cell }) => (
                <ListCell className={CELL} key={header} numeric>{cell(period)}</ListCell>
              ))}
            </ListRow>
          ))}
          <Spacer columns={columnCount} height={(rowCount - last) * ROW_HEIGHT} />
        </ListBody>
      </ListTable>
    </ListRegion>
  )
}

/**
 * The height of the rows not drawn. No transition: under reduced motion index.css would otherwise resize it a
 * frame after the rows, and the list's height would jump, moving its scroll position.
 */
function Spacer({ columns, height }: { columns: number; height: number }) {
  return (
    <tr aria-hidden="true" className="transition-none">
      <td className="p-0 transition-none" colSpan={columns} style={{ height }} />
    </tr>
  )
}
