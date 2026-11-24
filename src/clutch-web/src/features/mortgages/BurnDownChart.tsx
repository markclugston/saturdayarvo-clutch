import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { actualBalancePoints, useActualBalances, type ActualBalancePoint } from './actualBalances'
import { ENTER_DETAILS_MESSAGE } from './AmortizationSchedule'
import {
  areaPath,
  clientXToViewBox,
  labelPosition,
  monotonePath,
  nearestIndex,
  yearStepIndex,
  type ChartPoint,
} from './chartGeometry'
import { formatCents } from './formatCents'
import { formatDisplayDate } from './loanDraft'
import { daysBetween, type PaymentFrequency } from './repaymentDates'
import type { ScheduledPeriod } from './scheduleCalculation'

export const NOT_CALCULATED_CHART_MESSAGE = 'The burn down will appear once the schedule is calculated.'

type BurnDownChartProps = {
  /** True for a saved mortgage; a new, unsaved one shows the enter-details prompt instead. */
  saved: boolean
  /** The calculated Bank Schedule with its start; absent draws the empty frame. */
  schedule?: ScheduledPeriod[]
  openingBalanceCents?: number
  disbursalDate?: string
  /** With the Disbursal Date, build the same balances request as the schedule table. */
  paymentFrequency?: PaymentFrequency
  duration?: number
  /** The Mortgage Account selection, saved or not; its Actual Balances are plotted when there is a schedule. */
  accountId?: string
}

/** What the chart knows about the Actual Balance series. */
type Actual = {
  /** The account resolves: the legend lists Actual Balance. */
  selected: boolean
  /** Ready balances with a schedule row each; empty while loading, after a failure or with none. */
  ready: boolean
  points: ActualBalancePoint[]
  currencyCode: string
}

const NO_ACTUAL: Actual = { selected: false, ready: false, points: [], currencyCode: '' }

const GUIDES = [60, 110, 160, 210]
const PLOT_LEFT = 70
const PLOT_RIGHT = 580
const PLOT_TOP = 30
const PLOT_BOTTOM = 260
const Y_INTERVALS = 4
const X_TICKS = 5
/** Fill strength per series (R3, FR-003: at most 20%). */
const SCHEDULE_FILL_OPACITY = 0.18
const ACTUAL_FILL_OPACITY = 0.14
/** Rough width of the 11px "Actual Balance" end-of-line name, to keep it inside the plot (R10). */
const SERIES_NAME_WIDTH = 80
const SERIES_NAME = 'Actual Balance'
const VIEW_BOX = { width: 600, height: 300 }
/** Hover band width in viewBox units (at least 6, R5). */
const BAND_WIDTH = 8
const KEY_INSTRUCTIONS = 'Use the arrow keys, Home, End, Page Up and Page Down to read values; Escape hides them.'
const compactDollars = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** Smallest 1, 2, 2.5 or 5 times a power of ten that is at least `value`. */
function niceMaximum(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 2.5, 5, 10].map((step) => step * magnitude).find((candidate) => candidate >= value) ?? value
}

/** "$125K", or "-$125K" below zero. */
function tickLabel(value: number): string {
  return value < 0 ? `-$${compactDollars.format(-value)}` : `$${compactDollars.format(value)}`
}

type BalanceAxis = {
  upper: number
  lower: number
  ticks: number[]
  /** Y of a balance in dollars. */
  y: (value: number) => number
  /** Horizontal guide positions: the fixed four, or one per tick once the axis goes below $0. */
  guides: number[]
}

/** The balance axis in dollars: $0 to a nice maximum, extended below $0 for negative Actual Balances. */
function balanceAxis(openingBalanceCents: number, points: ActualBalancePoint[]): BalanceAxis {
  let largest = openingBalanceCents / 100
  let smallest = 0
  for (const point of points) {
    largest = Math.max(largest, point.value)
    smallest = Math.min(smallest, point.value)
  }
  const upper = niceMaximum(largest)
  const step = upper / Y_INTERVALS
  const below = smallest < 0 ? Math.ceil(-smallest / step) : 0
  const lower = -below * step
  const ticks = Array.from({ length: Y_INTERVALS + below + 1 }, (_, index) =>
    below === 0 ? (upper * index) / Y_INTERVALS : (index - below) * step)
  const y = (value: number) => PLOT_BOTTOM - ((PLOT_BOTTOM - PLOT_TOP) * (value - lower)) / (upper - lower)
  return { upper, lower, ticks, y, guides: below === 0 ? GUIDES : ticks.map(y) }
}

type Series = 'schedule' | 'actual'

/** Element ids for one chart's gradients and clip path (unique per chart, R2). */
type ChartIds = { schedule: string, actual: string, legendSchedule: string, legendActual: string }

function GradientStops({ series }: { series: Series }) {
  return (
    <>
      <stop className={`text-chart-${series}-start`} offset="0" stopColor="currentColor" />
      <stop className={`text-chart-${series}-mid`} offset="0.5" stopColor="currentColor" />
      <stop className={`text-chart-${series}-end`} offset="1" stopColor="currentColor" />
    </>
  )
}

/** Series gradients span the plot so a colour means the same date everywhere; legend gradients span each sample. */
function Gradients({ ids }: { ids: ChartIds }) {
  return (
    <defs>
      {(['schedule', 'actual'] as const).map((series) => (
        <linearGradient
          data-series={series}
          gradientUnits="userSpaceOnUse"
          id={ids[series]}
          key={series}
          x1={PLOT_LEFT}
          x2={PLOT_RIGHT}
          y1="0"
          y2="0"
        >
          <GradientStops series={series} />
        </linearGradient>
      ))}
      {(['schedule', 'actual'] as const).map((series) => (
        <linearGradient
          data-part="legend-gradient"
          data-series={series}
          gradientUnits="objectBoundingBox"
          id={series === 'schedule' ? ids.legendSchedule : ids.legendActual}
          key={`legend-${series}`}
          x1="0"
          x2="1"
          y1="0"
          y2="0"
        >
          <GradientStops series={series} />
        </linearGradient>
      ))}
    </defs>
  )
}

function Guides({ guides }: { guides: number[] }) {
  return (
    <>
      {guides.map((y) => (
        <line className="opacity-30" key={y} stroke="currentColor" strokeWidth="1" x1="70" x2="580" y1={y} y2={y} />
      ))}
    </>
  )
}

function Frame({ withActual, ids }: { withActual: boolean, ids: ChartIds }) {
  return (
    <>
      <line stroke="currentColor" strokeWidth="1.5" x1="70" x2="580" y1="260" y2="260" />
      <line stroke="currentColor" strokeWidth="1.5" x1="70" x2="70" y1="30" y2="260" />
      <text fill="currentColor" fontSize="12" textAnchor="middle" transform="rotate(-90 20 145)" x="20" y="145">
        Balance ($)
      </text>
      <text fill="currentColor" fontSize="12" textAnchor="middle" x="325" y="294">
        Repayment Date
      </text>
      <g data-part="legend" data-series="schedule">
        <rect fill={`url(#${ids.legendSchedule})`} height="3" width="24" x={withActual ? 270 : 400} y="13.5" />
        <text className="text-fg-secondary" fill="currentColor" fontSize="12" x={withActual ? 300 : 430} y="19">
          Bank Schedule
        </text>
      </g>
      {withActual && (
        <g data-part="legend" data-series="actual">
          <rect fill={`url(#${ids.legendActual})`} height="3" width="24" x="400" y="13.5" />
          <text className="text-fg-secondary" fill="currentColor" fontSize="12" x="430" y="19">
            Actual Balance
          </text>
        </g>
      )}
    </>
  )
}

/** One date the hover label can show: the Disbursal Date, then each schedule row (data-model.md). */
type PlottedDate = {
  date: string
  x: number
  /** The Opening Balance at the Disbursal Date, else the row's closing balance. */
  bankCents: number
  bankY: number
  /** The row's Actual Balance; never at the Disbursal Date. */
  actual?: { point: ActualBalancePoint, y: number }
}

/** Who moved the label last decides whether the pointer leaving hides it (FR-009a). */
type HoverState = {
  index: number
  source: 'pointer' | 'keyboard'
} | null

/** Everything the plotted chart draws that does not change while hovering (memoised, SC-003). */
type Plot = {
  dates: PlottedDate[]
  /** Ascending x of every plotted date. */
  xs: number[]
  scheduleLine: string
  scheduleArea: string
  actualLine: string
  actualArea: string
  /** The one Actual Balance, drawn as a dot. */
  single: ChartPoint | null
  /** The last Actual Balance point, where the series is named (R10). */
  actualEnd: ChartPoint | null
  yTicks: { value: number, y: number }[]
  xTicks: { date: string, year: string, x: number }[]
}

function plotGeometry(
  schedule: ScheduledPeriod[],
  openingBalanceCents: number,
  disbursalDate: string,
  axis: BalanceAxis,
  actualPoints: ActualBalancePoint[],
): Plot {
  const finalDate = schedule[schedule.length - 1]?.date ?? disbursalDate
  const totalDays = Math.max(1, daysBetween(disbursalDate, finalDate))
  const x = (date: string) => PLOT_LEFT + ((PLOT_RIGHT - PLOT_LEFT) * daysBetween(disbursalDate, date)) / totalDays
  const { y } = axis
  const zeroY = y(0)

  const dates = [disbursalDate, ...schedule.map((period) => period.date)]
  const xs = dates.map(x)
  const bank: ChartPoint[] = [
    { x: xs[0] ?? PLOT_LEFT, y: y(openingBalanceCents / 100) },
    ...schedule.map((period, index) => ({ x: xs[index + 1] ?? PLOT_LEFT, y: y(period.closingCents / 100) })),
  ]
  const actual = actualPoints.map((point) => ({ x: x(point.date), y: y(point.value) }))

  const xTicks: Plot['xTicks'] = []
  for (let index = 0; index < X_TICKS; index += 1) {
    const date = dates[Math.round((index * (dates.length - 1)) / (X_TICKS - 1))] ?? disbursalDate
    const year = date.slice(0, 4)
    if (xTicks[xTicks.length - 1]?.year !== year) {
      xTicks.push({ date, year, x: x(date) })
    }
  }

  const actualByDate = new Map(actualPoints.map((point, index) => [point.date, { point, y: actual[index]?.y ?? 0 }]))
  const plottedDates: PlottedDate[] = dates.map((date, index) => ({
    date,
    x: xs[index] ?? PLOT_LEFT,
    bankCents: index === 0 ? openingBalanceCents : schedule[index - 1]?.closingCents ?? 0,
    bankY: bank[index]?.y ?? PLOT_BOTTOM,
    actual: index === 0 ? undefined : actualByDate.get(date),
  }))

  return {
    dates: plottedDates,
    xs,
    scheduleLine: monotonePath(bank),
    scheduleArea: areaPath(bank, zeroY),
    actualLine: actual.length >= 2 ? monotonePath(actual) : '',
    actualArea: areaPath(actual, zeroY),
    single: actual.length === 1 ? actual[0] ?? null : null,
    actualEnd: actual[actual.length - 1] ?? null,
    yTicks: axis.ticks.map((value) => ({ value, y: y(value) })),
    xTicks,
  }
}

function AxisLabels({ plot }: { plot: Plot }) {
  return (
    <>
      {plot.yTicks.map((tick) => (
        <text fill="currentColor" fontSize="11" key={tick.value} textAnchor="end" x={PLOT_LEFT - 6} y={tick.y + 4}>
          {tickLabel(tick.value)}
        </text>
      ))}
      {plot.xTicks.map((tick) => (
        <text fill="currentColor" fontSize="11" key={tick.date} textAnchor="middle" x={tick.x} y="278">
          {tick.year}
        </text>
      ))}
    </>
  )
}

function Areas({ plot, ids }: { plot: Plot, ids: ChartIds }) {
  return (
    <>
      <path
        d={plot.scheduleArea}
        data-part="area"
        data-series="schedule"
        fill={`url(#${ids.schedule})`}
        fillOpacity={SCHEDULE_FILL_OPACITY}
      />
      {plot.actualArea && (
        <path
          d={plot.actualArea}
          data-part="area"
          data-series="actual"
          fill={`url(#${ids.actual})`}
          fillOpacity={ACTUAL_FILL_OPACITY}
        />
      )}
    </>
  )
}

function Lines({ plot, ids }: { plot: Plot, ids: ChartIds }) {
  return (
    <>
      <path
        d={plot.scheduleLine}
        data-part="line"
        data-series="schedule"
        fill="none"
        stroke={`url(#${ids.schedule})`}
        strokeLinejoin="round"
        strokeWidth="2"
      />
      {plot.actualLine && (
        <path
          d={plot.actualLine}
          data-part="line"
          data-series="actual"
          fill="none"
          stroke={`url(#${ids.actual})`}
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {plot.single && (
        <circle
          cx={plot.single.x}
          cy={plot.single.y}
          data-part="dot"
          data-series="actual"
          fill={`url(#${ids.actual})`}
          r="3"
        />
      )}
      {plot.actualEnd && <SeriesName point={plot.actualEnd} />}
    </>
  )
}

/**
 * Names the Actual Balance line at its last point, so the two solid lines are told apart without colour (FR-004,
 * R10): to the right of the point, or above it, ending at the point, when the right has no room.
 */
function SeriesName({ point }: { point: ChartPoint }) {
  const right = point.x + 6 + SERIES_NAME_WIDTH <= PLOT_RIGHT
  const aboveY = point.y - 8 < PLOT_TOP + 10 ? point.y + 16 : point.y - 8
  return (
    <text
      className="pointer-events-none stroke-card text-fg-secondary"
      data-part="series-name"
      data-series="actual"
      fill="currentColor"
      fontSize="11"
      paintOrder="stroke"
      strokeLinejoin="round"
      strokeWidth="3"
      textAnchor={right ? 'start' : 'end'}
      x={right ? point.x + 6 : point.x}
      y={right ? point.y + 4 : aboveY}
    >
      {SERIES_NAME}
    </text>
  )
}

/** The hovered date's highlight, drawn above the fills and below the guides (R3, R5). */
function Band({ date }: { date: PlottedDate }) {
  return (
    <rect
      className="pointer-events-none fill-fg"
      data-part="band"
      fillOpacity={0.05}
      height={PLOT_BOTTOM - PLOT_TOP}
      width={BAND_WIDTH}
      x={date.x - BAND_WIDTH / 2}
      y={PLOT_TOP}
    />
  )
}

/** A ring on each series' point at the hovered date, in that series' gradient. */
function Rings({ date, ids }: { date: PlottedDate, ids: ChartIds }) {
  const ring = (series: Series, y: number) => (
    <circle
      className="pointer-events-none fill-card"
      cx={date.x}
      cy={y}
      data-part="ring"
      data-series={series}
      key={series}
      r="4.5"
      stroke={`url(#${ids[series]})`}
      strokeWidth="2"
    />
  )
  return (
    <>
      {ring('schedule', date.bankY)}
      {date.actual && ring('actual', date.actual.y)}
    </>
  )
}

/** The hovered date's values as the label shows them and the announcer reads them (FR-007, FR-008). */
function labelValues(date: PlottedDate, currencyCode: string) {
  return {
    date: formatDisplayDate(date.date),
    rows: [
      { name: 'Bank Schedule', amount: formatCents(date.bankCents) },
      ...(date.actual ? [{ name: 'Actual Balance', amount: formatCurrencyAmount(date.actual.point.amount, currencyCode) }] : []),
    ],
  }
}

function announcementFor(date: PlottedDate, currencyCode: string): string {
  const values = labelValues(date, currencyCode)
  return `${values.date}. ${values.rows.map((row) => `${row.name} ${row.amount}.`).join(' ')}`
}

/**
 * The visible label, an in-chart overlay styled like the tooltip popup. It follows the hovered date: measured before
 * paint and placed beside the band at the rings' height, inside the chart (FR-010, R5).
 */
function HoverLabel({ date, currencyCode, svgRef }: {
  date: PlottedDate
  currencyCode: string
  svgRef: RefObject<SVGSVGElement | null>
}) {
  const values = labelValues(date, currencyCode)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    const rect = svgRef.current?.getBoundingClientRect()
    if (!element || !rect) {
      return
    }
    // The SVG fills the label's container, letterboxed by `xMidYMid meet`.
    const scale = rect.width > 0 && rect.height > 0
      ? Math.min(rect.width / VIEW_BOX.width, rect.height / VIEW_BOX.height)
      : 0
    const offsetX = (rect.width - VIEW_BOX.width * scale) / 2
    const offsetY = (rect.height - VIEW_BOX.height * scale) / 2
    const ys = [date.bankY, ...(date.actual ? [date.actual.y] : [])].map((y) => offsetY + y * scale)
    const position = labelPosition(
      { width: rect.width, height: rect.height },
      { width: element.offsetWidth, height: element.offsetHeight },
      offsetX + date.x * scale,
      ys,
    )
    element.style.left = `${position.left}px`
    element.style.top = `${position.top}px`
    element.dataset.side = position.side
  }, [date, svgRef])
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 w-max max-w-full rounded-control bg-raised px-2.5 py-1.5 text-xs text-fg shadow-float"
      data-slot="burndown-label"
      ref={ref}
    >
      <p className="font-medium">{values.date}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
        {values.rows.map((row) => (
          <div className="contents" key={row.name}>
            <dt className="text-fg-secondary">{row.name}</dt>
            <dd className="text-right tabular-nums">{row.amount}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Text alternative sentence for the Actual Balance series; '' when nothing is to be said. */
function actualDescription({ ready, points, currencyCode }: Actual): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (!ready) {
    return ''
  }
  if (!first || !last) {
    return ' Actual Balance: there are no actual balances to plot.'
  }
  const amount = (value: string) => formatCurrencyAmount(value, currencyCode)
  return first === last
    ? ` Actual Balance: ${amount(first.amount)} on ${formatDisplayDate(first.date)}.`
    : ` Actual Balance: from ${amount(first.amount)} on ${formatDisplayDate(first.date)} to ${amount(last.amount)} on ${formatDisplayDate(last.date)}.`
}

/** Balance-over-time chart: the Bank Schedule line when calculated, otherwise the empty frame. */
export function BurnDownChart(props: BurnDownChartProps) {
  return props.accountId === undefined
    ? <Chart {...props} actual={NO_ACTUAL} />
    : <AccountChart {...props} accountId={props.accountId} />
}

/** Reads the account's balances through the schedule table's own request, then draws the chart. */
function AccountChart({ accountId, ...props }: BurnDownChartProps & { accountId: string }) {
  const { schedule, duration, disbursalDate, paymentFrequency } = props
  const balances = useActualBalances(accountId, { duration, disbursalDate, paymentFrequency })
  const plotted = schedule !== undefined && schedule.length > 0
    && props.openingBalanceCents !== undefined && disbursalDate !== undefined
  const points = useMemo(
    () => (balances.status === 'ready' && schedule ? actualBalancePoints(balances.balances, schedule) : []),
    [balances.status, balances.balances, schedule],
  )
  const actual: Actual = {
    // The Bank Schedule must be plotted for Actual Balance to appear (FR-005).
    selected: plotted && balances.status !== 'none',
    ready: plotted && balances.status === 'ready',
    points: plotted ? points : [],
    currencyCode: balances.currencyCode ?? '',
  }
  return <Chart {...props} actual={actual} />
}

function Chart({
  saved,
  schedule,
  openingBalanceCents,
  disbursalDate,
  actual,
}: BurnDownChartProps & { actual: Actual }) {
  const id = useId()
  const ids = useMemo<ChartIds>(() => ({
    schedule: `${id}schedule`,
    actual: `${id}actual`,
    legendSchedule: `${id}legend-schedule`,
    legendActual: `${id}legend-actual`,
  }), [id])
  const plotted = schedule !== undefined && schedule.length > 0
    && openingBalanceCents !== undefined && disbursalDate !== undefined
  const finalDate = schedule?.[schedule.length - 1]?.date
  const axis = useMemo(
    () => (openingBalanceCents === undefined ? null : balanceAxis(openingBalanceCents, actual.points)),
    [openingBalanceCents, actual.points],
  )
  const plot = useMemo(
    () => (plotted && axis ? plotGeometry(schedule, openingBalanceCents, disbursalDate, axis, actual.points) : null),
    [plotted, schedule, openingBalanceCents, disbursalDate, axis, actual.points],
  )
  const [hover, setHover] = useState<HoverState>(null)
  const [announcement, setAnnouncement] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  // Derived, not synced: a schedule that shrinks under the label simply hides it (R8).
  const hovered = hover && plot ? plot.dates[hover.index] : undefined

  // The parts that do not move while hovering are memoised, so a pointer move redraws only the overlay (SC-003).
  const withActual = actual.selected
  const guides = plotted && axis ? axis.guides : GUIDES
  const areas = useMemo(() => plot && <Areas ids={ids} plot={plot} />, [plot, ids])
  const frame = useMemo(() => (
    <>
      <Guides guides={guides} />
      <Frame ids={ids} withActual={withActual} />
      {plot && <AxisLabels plot={plot} />}
    </>
  ), [guides, ids, withActual, plot])
  const lines = useMemo(() => plot && <Lines ids={ids} plot={plot} />, [plot, ids])

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!plot || !rect || rect.width === 0 || rect.height === 0) {
      return
    }
    const index = nearestIndex(plot.xs, clientXToViewBox(event.clientX, rect, VIEW_BOX))
    if (index < 0) {
      return
    }
    setHover((previous) => (previous?.index === index && previous.source === 'pointer'
      ? previous
      : { index, source: 'pointer' }))
    setAnnouncement('')
  }

  function handlePointerLeave() {
    setHover((previous) => (previous?.source === 'pointer' ? null : previous))
  }

  function hide() {
    setHover(null)
    setAnnouncement('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!plot) {
      return
    }
    const last = plot.dates.length - 1
    const current = hovered ? hover?.index : undefined
    if (event.key === 'Escape') {
      if (current !== undefined) {
        event.preventDefault()
        hide()
      }
      return
    }
    const dateStrings = plot.dates.map((date) => date.date)
    const targets: Record<string, () => number> = {
      ArrowRight: () => (current === undefined ? 0 : Math.min(last, current + 1)),
      ArrowLeft: () => (current === undefined ? last : Math.max(0, current - 1)),
      Home: () => 0,
      End: () => last,
      PageDown: () => (current === undefined ? 0 : yearStepIndex(dateStrings, current, 1)),
      PageUp: () => (current === undefined ? last : yearStepIndex(dateStrings, current, -1)),
    }
    const target = targets[event.key]
    if (!target) {
      return
    }
    event.preventDefault()
    const index = target()
    const date = plot.dates[index]
    if (!date) {
      return
    }
    setHover({ index, source: 'keyboard' })
    setAnnouncement(announcementFor(date, actual.currencyCode))
  }

  if (!saved && !plotted) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
      </div>
    )
  }

  const label = plotted
    ? `Line chart of the mortgage balance over time for the Bank Schedule, falling from ${formatCents(openingBalanceCents)} on ${formatDisplayDate(disbursalDate)} to $0.00 on ${formatDisplayDate(finalDate ?? disbursalDate)}.${actualDescription(actual)}`
    : 'Line chart of the mortgage balance over time for the Bank schedule. The values have not been calculated yet.'

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative min-h-64 flex-1">
        {plot
          ? (
              <div
                aria-describedby={`${id}keys`}
                aria-label="Burndown Values"
                className="absolute inset-0 rounded-control focus-visible:focus-ring"
                onBlur={hide}
                onKeyDown={handleKeyDown}
                role="group"
                tabIndex={0}
              >
                <svg aria-label={label} className="absolute inset-0 size-full text-fg-secondary" ref={svgRef} role="img" viewBox="0 0 600 300">
                  <Gradients ids={ids} />
                  {areas}
                  {hovered && <Band date={hovered} />}
                  {frame}
                  {lines}
                  {hovered && <Rings date={hovered} ids={ids} />}
                  {/* Drawn last and transparent: the only element that takes the pointer (FR-010). */}
                  <rect
                    className="fill-transparent"
                    data-part="pointer-area"
                    height={PLOT_BOTTOM - PLOT_TOP}
                    onPointerLeave={handlePointerLeave}
                    onPointerMove={handlePointerMove}
                    width={PLOT_RIGHT - PLOT_LEFT}
                    x={PLOT_LEFT}
                    y={PLOT_TOP}
                  />
                </svg>
                {hovered && <HoverLabel currencyCode={actual.currencyCode} date={hovered} svgRef={svgRef} />}
                <span className="sr-only" id={`${id}keys`}>{KEY_INSTRUCTIONS}</span>
                <div aria-live="polite" className="sr-only" role="status">{announcement}</div>
              </div>
            )
          : (
              <svg aria-label={label} className="absolute inset-0 size-full text-fg-secondary" role="img" viewBox="0 0 600 300">
                <Gradients ids={ids} />
                {frame}
              </svg>
            )}
      </div>
      {!plotted && <p className="mt-2 text-sm text-fg-secondary">{NOT_CALCULATED_CHART_MESSAGE}</p>}
    </div>
  )
}
