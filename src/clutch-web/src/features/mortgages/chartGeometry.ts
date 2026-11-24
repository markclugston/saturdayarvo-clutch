import { daysBetween, daysInMonth } from './repaymentDates'

/** A point in the chart's viewBox units. */
export type ChartPoint = { x: number, y: number }

/** Fritsch–Carlson tangent at a middle point (as d3 curveMonotoneX): 0 at a turn, never steep enough to overshoot. */
function middleTangent(previous: ChartPoint, point: ChartPoint, next: ChartPoint): number {
  const before = point.x - previous.x
  const after = next.x - point.x
  const slopeBefore = (point.y - previous.y) / before
  const slopeAfter = (next.y - point.y) / after
  const weighted = (slopeBefore * after + slopeAfter * before) / (before + after)
  const tangent = (Math.sign(slopeBefore) + Math.sign(slopeAfter))
    * Math.min(Math.abs(slopeBefore), Math.abs(slopeAfter), 0.5 * Math.abs(weighted))
  return Number.isFinite(tangent) ? tangent : 0
}

/** One-sided tangent at an end point from its segment's slope and the neighbouring tangent. */
function endTangent(from: ChartPoint, to: ChartPoint, neighbour: number): number {
  const width = to.x - from.x
  return width ? (3 * (to.y - from.y) / width - neighbour) / 2 : neighbour
}

/**
 * Monotone cubic path through every point (ascending x). Each segment's control points stay within the y range of
 * its two ends, so the line never overshoots or rises between falling points (FR-005).
 */
export function monotonePath(points: ChartPoint[]): string {
  const [first, second] = points
  if (!first) {
    return ''
  }
  if (!second) {
    return `M ${first.x},${first.y}`
  }
  if (points.length === 2) {
    return `M ${first.x},${first.y} L ${second.x},${second.y}`
  }
  const tangents = points.map((point, index) => {
    const previous = points[index - 1]
    const next = points[index + 1]
    return previous && next ? middleTangent(previous, point, next) : 0
  })
  const last = points.length - 1
  tangents[0] = endTangent(first, second, tangents[1] ?? 0)
  const beforeLast = points[last - 1] ?? first
  const lastPoint = points[last] ?? first
  tangents[last] = endTangent(beforeLast, lastPoint, tangents[last - 1] ?? 0)

  const commands = [`M ${first.x},${first.y}`]
  for (let index = 1; index <= last; index += 1) {
    const from = points[index - 1] ?? first
    const to = points[index] ?? first
    const third = (to.x - from.x) / 3
    const start = tangents[index - 1] ?? 0
    const end = tangents[index] ?? 0
    commands.push(`C ${from.x + third},${from.y + third * start} ${to.x - third},${to.y - third * end} ${to.x},${to.y}`)
  }
  return commands.join(' ')
}

/** The area between the monotone line and `zeroY` (y of $0), filling above and below it; '' below two points. */
export function areaPath(points: ChartPoint[], zeroY: number): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || points.length < 2) {
    return ''
  }
  return `${monotonePath(points)} L ${last.x},${zeroY} L ${first.x},${zeroY} Z`
}

/** Index of the x nearest `x` in ascending `xs` (binary search); ties go to the earlier; -1 when empty. */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) {
    return -1
  }
  let low = 0
  let high = xs.length - 1
  if (x <= (xs[low] ?? x)) {
    return low
  }
  if (x >= (xs[high] ?? x)) {
    return high
  }
  // Invariant: xs[low] <= x < xs[high].
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if ((xs[middle] ?? x) <= x) {
      low = middle
    } else {
      high = middle
    }
  }
  return x - (xs[low] ?? x) <= (xs[high] ?? x) - x ? low : high
}

/** `yyyy-MM-dd` moved by whole years, with 29 February becoming 28 February in other years. */
function addYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4)) + years
  const month = Number(date.slice(5, 7))
  const day = Math.min(Number(date.slice(8, 10)), daysInMonth(year, month))
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Index of the date (ascending `dates`) nearest one calendar year after (`1`) or before (`-1`) `dates[index]`,
 * moving at least one date and stopping at the first or last.
 */
export function yearStepIndex(dates: string[], index: number, direction: 1 | -1): number {
  const current = dates[index]
  if (current === undefined) {
    return index
  }
  const target = addYears(current, direction)
  let best = index
  let bestDistance = Number.POSITIVE_INFINITY
  dates.forEach((date, candidate) => {
    const distance = Math.abs(daysBetween(target, date))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  })
  const stepped = best === index ? index + direction : best
  return Math.min(dates.length - 1, Math.max(0, stepped))
}

/** clientX in viewBox units for an SVG drawn with the default `xMidYMid meet`. */
export function clientXToViewBox(
  clientX: number,
  rect: { left: number, width: number, height: number },
  viewBox: { width: number, height: number },
): number {
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height)
  const offset = (rect.width - viewBox.width * scale) / 2
  return (clientX - rect.left - offset) / scale
}

export type Size = { width: number, height: number }

/** Where the hover label goes: beside the band (right, else left), or over the date when neither side has room. */
export type LabelPlacement = { left: number, top: number, side: 'right' | 'left' | 'over' }

/** Gap between the hovered date (or its rings) and the label, in pixels. */
export const LABEL_GAP = 12

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

/**
 * Places the hover label so it follows the hovered date (FR-010): beside the band at the height of the rings, kept
 * inside the container. `x` and `ys` are the hovered date and its ring centres in container pixels.
 */
export function labelPosition(container: Size, label: Size, x: number, ys: number[]): LabelPlacement {
  const highest = ys.length > 0 ? Math.min(...ys) : container.height / 2
  const lowest = ys.length > 0 ? Math.max(...ys) : container.height / 2
  const maxTop = container.height - label.height
  const top = clamp((highest + lowest) / 2 - label.height / 2, 0, maxTop)
  if (x + LABEL_GAP + label.width <= container.width) {
    return { left: x + LABEL_GAP, top, side: 'right' }
  }
  if (x - LABEL_GAP - label.width >= 0) {
    return { left: x - LABEL_GAP - label.width, top, side: 'left' }
  }
  const left = clamp(x - label.width / 2, 0, container.width - label.width)
  const above = highest - LABEL_GAP - label.height
  return { left, top: above >= 0 ? above : clamp(lowest + LABEL_GAP, 0, maxTop), side: 'over' }
}
