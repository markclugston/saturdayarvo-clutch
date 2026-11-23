import { ENTER_DETAILS_MESSAGE } from './AmortizationSchedule'
import { formatCurrency } from './FormattedNumberField'
import { formatDisplayDate } from './loanDraft'
import { daysBetween } from './repaymentDates'
import type { ScheduledPeriod } from './scheduleCalculation'

export const NOT_CALCULATED_CHART_MESSAGE = 'The burn down will appear once the schedule is calculated.'

type BurnDownChartProps = {
  /** True for a saved mortgage; a new, unsaved one shows the enter-details prompt instead. */
  saved: boolean
  /** The calculated Bank Schedule with its start; absent draws the empty frame. */
  schedule?: ScheduledPeriod[]
  openingBalanceCents?: number
  disbursalDate?: string
}

const GUIDES = [60, 110, 160, 210]
const PLOT_LEFT = 70
const PLOT_RIGHT = 580
const PLOT_TOP = 30
const PLOT_BOTTOM = 260
const Y_INTERVALS = 4
const X_TICKS = 5
const compactDollars = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** Smallest 1, 2, 2.5 or 5 times a power of ten that is at least `value`. */
function niceMaximum(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 2.5, 5, 10].map((step) => step * magnitude).find((candidate) => candidate >= value) ?? value
}

function dollars(cents: number): string {
  return formatCurrency(`${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`)
}

function Frame() {
  return (
    <>
      {GUIDES.map((y) => (
        <line className="opacity-30" key={y} stroke="currentColor" strokeWidth="1" x1="70" x2="580" y1={y} y2={y} />
      ))}
      <line stroke="currentColor" strokeWidth="1.5" x1="70" x2="580" y1="260" y2="260" />
      <line stroke="currentColor" strokeWidth="1.5" x1="70" x2="70" y1="30" y2="260" />
      <text fill="currentColor" fontSize="12" textAnchor="middle" transform="rotate(-90 20 145)" x="20" y="145">
        Balance ($)
      </text>
      <text fill="currentColor" fontSize="12" textAnchor="middle" x="325" y="294">
        Repayment Date
      </text>
      <g className="text-primary">
        <line stroke="currentColor" strokeWidth="3" x1="400" x2="424" y1="15" y2="15" />
        <text className="text-fg-secondary" fill="currentColor" fontSize="12" x="430" y="19">
          Bank Schedule
        </text>
      </g>
    </>
  )
}

function PlottedLine({
  schedule,
  openingBalanceCents,
  disbursalDate,
}: { schedule: ScheduledPeriod[], openingBalanceCents: number, disbursalDate: string }) {
  const finalDate = schedule[schedule.length - 1]?.date ?? disbursalDate
  const totalDays = Math.max(1, daysBetween(disbursalDate, finalDate))
  const maximum = niceMaximum(openingBalanceCents / 100)
  const x = (date: string) => PLOT_LEFT + ((PLOT_RIGHT - PLOT_LEFT) * daysBetween(disbursalDate, date)) / totalDays
  const y = (cents: number) => PLOT_BOTTOM - ((PLOT_BOTTOM - PLOT_TOP) * (cents / 100)) / maximum

  const points = [
    `${x(disbursalDate)},${y(openingBalanceCents)}`,
    ...schedule.map((period) => `${x(period.date)},${y(period.closingCents)}`),
  ].join(' ')

  const dates = [disbursalDate, ...schedule.map((period) => period.date)]
  const yTicks = Array.from({ length: Y_INTERVALS + 1 }, (_, index) => (maximum * index) / Y_INTERVALS)
  const xTicks: { date: string, year: string }[] = []
  for (let index = 0; index < X_TICKS; index += 1) {
    const date = dates[Math.round((index * (dates.length - 1)) / (X_TICKS - 1))] ?? disbursalDate
    const year = date.slice(0, 4)
    if (xTicks[xTicks.length - 1]?.year !== year) {
      xTicks.push({ date, year })
    }
  }

  return (
    <>
      {yTicks.map((value) => (
        <text
          fill="currentColor"
          fontSize="11"
          key={value}
          textAnchor="end"
          x={PLOT_LEFT - 6}
          y={PLOT_BOTTOM - ((PLOT_BOTTOM - PLOT_TOP) * value) / maximum + 4}
        >
          {`$${compactDollars.format(value)}`}
        </text>
      ))}
      {xTicks.map((tick) => (
        <text fill="currentColor" fontSize="11" key={tick.date} textAnchor="middle" x={x(tick.date)} y="278">
          {tick.year}
        </text>
      ))}
      <polyline
        className="text-primary"
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </>
  )
}

/** Balance-over-time chart: the Bank Schedule line when calculated, otherwise the empty frame. */
export function BurnDownChart({ saved, schedule, openingBalanceCents, disbursalDate }: BurnDownChartProps) {
  const plotted = schedule !== undefined && schedule.length > 0
    && openingBalanceCents !== undefined && disbursalDate !== undefined
  const finalDate = schedule?.[schedule.length - 1]?.date

  if (!saved && !plotted) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
      </div>
    )
  }

  const label = plotted
    ? `Line chart of the mortgage balance over time for the Bank Schedule, falling from ${dollars(openingBalanceCents)} on ${formatDisplayDate(disbursalDate)} to $0.00 on ${formatDisplayDate(finalDate ?? disbursalDate)}.`
    : 'Line chart of the mortgage balance over time for the Bank schedule. The values have not been calculated yet.'

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative min-h-64 flex-1">
        <svg aria-label={label} className="absolute inset-0 size-full text-fg-secondary" role="img" viewBox="0 0 600 300">
          <Frame />
          {plotted && (
            <PlottedLine
              disbursalDate={disbursalDate}
              openingBalanceCents={openingBalanceCents}
              schedule={schedule}
            />
          )}
        </svg>
      </div>
      {!plotted && <p className="mt-2 text-sm text-fg-secondary">{NOT_CALCULATED_CHART_MESSAGE}</p>}
    </div>
  )
}
