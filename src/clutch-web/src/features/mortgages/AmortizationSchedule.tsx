import { useState } from 'react'

export const ENTER_DETAILS_MESSAGE = 'Please enter your mortgage details'
export const NOT_CALCULATED = 'Not yet calculated'

const ROW_HEIGHT = 40
const FALLBACK_VIEWPORT_HEIGHT = 384
const OVERSCAN = 8

type AmortizationScheduleProps = {
  /** Saved Duration of the selected mortgage; undefined for a new, unsaved one. */
  duration?: number
}

/** Read-only placeholder schedule: periods 1 to N + 1, rendered through a window so any N stays usable. */
export function AmortizationSchedule({ duration }: AmortizationScheduleProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {duration === undefined
        ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
        : <ScheduleTable rowCount={duration + 1} />}
    </div>
  )
}

function ScheduleTable({ rowCount }: { rowCount: number }) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT_HEIGHT)

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const periods: number[] = []
  for (let index = first; index < last; index += 1) {
    periods.push(index + 1)
  }

  return (
    <div
      className="h-96 min-h-0 overflow-auto rounded-control focus-visible:focus-ring"
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop)
        if (event.currentTarget.clientHeight > 0) {
          setViewportHeight(event.currentTarget.clientHeight)
        }
      }}
      ref={(element) => {
        if (element && element.clientHeight > 0 && element.clientHeight !== viewportHeight) {
          setViewportHeight(element.clientHeight)
        }
      }}
      tabIndex={0}
    >
      <div aria-rowcount={rowCount + 1} className="min-w-80 text-sm" role="table">
        <div
          aria-rowindex={1}
          className="sticky top-0 z-10 grid grid-cols-[5rem_1fr_1fr] bg-card font-semibold"
          role="row"
          style={{ height: ROW_HEIGHT }}
        >
          <div className="flex items-center px-3" role="columnheader">Period</div>
          <div className="flex items-center px-3" role="columnheader">Date</div>
          <div className="flex items-center px-3" role="columnheader">Bank Schedule</div>
        </div>
        <div role="rowgroup">
          <div aria-hidden="true" role="presentation" style={{ height: first * ROW_HEIGHT }} />
          {periods.map((period) => (
            <div
              aria-rowindex={period + 1}
              className="grid grid-cols-[5rem_1fr_1fr] odd:bg-raised"
              key={period}
              role="row"
              style={{ height: ROW_HEIGHT }}
            >
              <div className="flex items-center px-3" role="cell">{period}</div>
              <div className="flex items-center px-3 text-fg-secondary" role="cell">{NOT_CALCULATED}</div>
              <div className="flex items-center px-3 text-fg-secondary" role="cell">{NOT_CALCULATED}</div>
            </div>
          ))}
          <div aria-hidden="true" role="presentation" style={{ height: (rowCount - last) * ROW_HEIGHT }} />
        </div>
      </div>
    </div>
  )
}
