import { describe, expect, it } from 'vitest'
import { areaPath, clientXToViewBox, LABEL_GAP, labelPosition, monotonePath, nearestIndex, yearStepIndex, type ChartPoint } from './chartGeometry'

type Segment = { c1: ChartPoint, c2: ChartPoint, end: ChartPoint }

/** Parses `M x,y C x,y x,y x,y …` (and `L x,y`) into the start point and its segments. */
function parse(path: string): { start: ChartPoint, segments: Segment[], rest: string } {
  const tokens = path.trim().split(/\s+/)
  const pair = (token: string | undefined): ChartPoint => {
    const [x, y] = (token ?? '').split(',').map(Number)
    return { x: x ?? Number.NaN, y: y ?? Number.NaN }
  }
  expect(tokens[0]).toBe('M')
  const start = pair(tokens[1])
  const segments: Segment[] = []
  let index = 2
  while (tokens[index] === 'C' || tokens[index] === 'L') {
    if (tokens[index] === 'C') {
      segments.push({ c1: pair(tokens[index + 1]), c2: pair(tokens[index + 2]), end: pair(tokens[index + 3]) })
      index += 4
    } else {
      const end = pair(tokens[index + 1])
      if (tokens[index + 2] === 'Z' || tokens[index + 2] === 'L') {
        break
      }
      segments.push({ c1: end, c2: end, end })
      index += 2
    }
  }
  return { start, segments, rest: tokens.slice(index).join(' ') }
}

const falling: ChartPoint[] = [
  { x: 70, y: 30 }, { x: 100, y: 40 }, { x: 110, y: 120 }, { x: 300, y: 125 }, { x: 320, y: 125 }, { x: 580, y: 260 },
]
const wiggly: ChartPoint[] = [
  { x: 70, y: 100 }, { x: 90, y: 60 }, { x: 130, y: 200 }, { x: 140, y: 190 }, { x: 200, y: 260 }, { x: 260, y: 40 },
]

describe('monotonePath', () => {
  it('passes through every point, in order', () => {
    for (const points of [falling, wiggly]) {
      const { start, segments } = parse(monotonePath(points))
      expect([start, ...segments.map((segment) => segment.end)]).toEqual(points)
    }
  })

  it('never places a control point outside the y range of its two neighbouring points (FR-005)', () => {
    for (const points of [falling, wiggly]) {
      const { segments } = parse(monotonePath(points))
      segments.forEach((segment, index) => {
        const from = points[index] ?? { x: 0, y: 0 }
        const to = points[index + 1] ?? { x: 0, y: 0 }
        const low = Math.min(from.y, to.y) - 1e-9
        const high = Math.max(from.y, to.y) + 1e-9
        for (const control of [segment.c1, segment.c2]) {
          expect(control.y).toBeGreaterThanOrEqual(low)
          expect(control.y).toBeLessThanOrEqual(high)
          expect(control.x).toBeGreaterThanOrEqual(from.x - 1e-9)
          expect(control.x).toBeLessThanOrEqual(to.x + 1e-9)
        }
      })
    }
  })

  it('is flat between two equal balances', () => {
    const { segments } = parse(monotonePath(falling))
    expect(segments[3]?.c1.y).toBe(125)
    expect(segments[3]?.c2.y).toBe(125)
  })

  it('draws a move for one point and a straight line for two', () => {
    expect(monotonePath([{ x: 70, y: 30 }])).toBe('M 70,30')
    expect(monotonePath([{ x: 70, y: 30 }, { x: 580, y: 260 }])).toBe('M 70,30 L 580,260')
    expect(monotonePath([])).toBe('')
  })
})

describe('areaPath', () => {
  it('closes the line down to y($0) and back to the start', () => {
    const line = monotonePath(falling)
    expect(areaPath(falling, 260)).toBe(`${line} L 580,260 L 70,260 Z`)
  })

  it('fills above and below $0 for negative balances', () => {
    const points = [{ x: 70, y: 100 }, { x: 200, y: 240 }, { x: 300, y: 250 }]
    const area = areaPath(points, 220)
    const { start, segments, rest } = parse(area)
    expect(start).toEqual(points[0])
    expect(segments.map((segment) => segment.end)).toEqual(points.slice(1))
    expect(rest).toBe('L 300,220 L 70,220 Z')
  })

  it('is empty for fewer than two points', () => {
    expect(areaPath([{ x: 70, y: 30 }], 260)).toBe('')
  })
})

describe('nearestIndex', () => {
  const xs = [70, 100, 130, 200, 580]

  it('finds the nearest x by binary search', () => {
    expect(nearestIndex(xs, 70)).toBe(0)
    expect(nearestIndex(xs, 84)).toBe(0)
    expect(nearestIndex(xs, 86)).toBe(1)
    expect(nearestIndex(xs, 170)).toBe(3)
    expect(nearestIndex(xs, 579)).toBe(4)
  })

  it('gives ties to the earlier date', () => {
    expect(nearestIndex(xs, 85)).toBe(0)
    expect(nearestIndex(xs, 165)).toBe(2)
  })

  it('clamps outside the plot', () => {
    expect(nearestIndex(xs, -50)).toBe(0)
    expect(nearestIndex(xs, 900)).toBe(4)
    expect(nearestIndex([], 100)).toBe(-1)
  })
})

describe('yearStepIndex', () => {
  const monthly = Array.from({ length: 37 }, (_, index) => {
    const month = 10 + index
    return `${2023 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}-29`
  })

  it('moves to the plotted date nearest one calendar year later or earlier', () => {
    expect(monthly[0]).toBe('2023-11-29')
    expect(monthly[yearStepIndex(monthly, 0, 1)]).toBe('2024-11-29')
    expect(monthly[yearStepIndex(monthly, 14, -1)]).toBe('2024-01-29')
  })

  it('moves at least one date when dates are more than a year apart', () => {
    const sparse = ['2020-01-01', '2023-01-01', '2026-01-01']
    expect(yearStepIndex(sparse, 0, 1)).toBe(1)
    expect(yearStepIndex(sparse, 2, -1)).toBe(1)
  })

  it('stops at the first and last dates', () => {
    expect(yearStepIndex(monthly, 30, 1)).toBe(36)
    expect(yearStepIndex(monthly, 36, 1)).toBe(36)
    expect(yearStepIndex(monthly, 5, -1)).toBe(0)
    expect(yearStepIndex(monthly, 0, -1)).toBe(0)
  })

  it('handles 29 February', () => {
    const dates = ['2024-02-29', '2024-08-29', '2025-02-28', '2025-03-01']
    expect(yearStepIndex(dates, 0, 1)).toBe(2)
  })
})

describe('clientXToViewBox', () => {
  const viewBox = { width: 600, height: 300 }

  it('scales clientX into viewBox units', () => {
    const rect = { left: 100, width: 1200, height: 600 }
    expect(clientXToViewBox(100, rect, viewBox)).toBe(0)
    expect(clientXToViewBox(700, rect, viewBox)).toBe(300)
    expect(clientXToViewBox(1300, rect, viewBox)).toBe(600)
  })

  it('accounts for xMidYMid meet letterboxing when the box is wider than the viewBox', () => {
    // Height limits the scale to 1; 200px of empty space sits either side.
    const rect = { left: 0, width: 1000, height: 300 }
    expect(clientXToViewBox(200, rect, viewBox)).toBe(0)
    expect(clientXToViewBox(800, rect, viewBox)).toBe(600)
  })

  it('accounts for a box taller than the viewBox', () => {
    const rect = { left: 10, width: 300, height: 600 }
    expect(clientXToViewBox(160, rect, viewBox)).toBe(300)
  })
})

describe('labelPosition', () => {
  const container = { width: 600, height: 300 }
  const label = { width: 180, height: 60 }

  it('sits to the right of the date, centred on the rings', () => {
    expect(labelPosition(container, label, 100, [80, 160])).toEqual({ left: 112, top: 90, side: 'right' })
  })

  it('moves to the left of the date when the right has no room', () => {
    expect(labelPosition(container, label, 500, [150])).toEqual({ left: 308, top: 120, side: 'left' })
  })

  it('follows the date at every x, never jumping to the far side', () => {
    for (let x = 0; x <= 600; x += 10) {
      const { left, side } = labelPosition(container, label, x, [150])
      const gap = side === 'right' ? left - x : x - (left + label.width)
      expect(gap).toBe(LABEL_GAP)
    }
  })

  it('stays inside the container vertically', () => {
    expect(labelPosition(container, label, 100, [5]).top).toBe(0)
    expect(labelPosition(container, label, 100, [298]).top).toBe(240)
  })

  it('overlaps the date above the rings when neither side has room', () => {
    const narrow = { width: 280, height: 300 }
    expect(labelPosition(narrow, label, 140, [200, 220])).toEqual({ left: 50, top: 128, side: 'over' })
  })

  it('overlaps the date below the rings when there is no room above', () => {
    const narrow = { width: 280, height: 300 }
    expect(labelPosition(narrow, label, 140, [30, 40])).toEqual({ left: 50, top: 52, side: 'over' })
  })
})
