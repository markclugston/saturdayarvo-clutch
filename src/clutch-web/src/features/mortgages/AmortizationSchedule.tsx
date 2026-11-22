import { useEffect, useRef, useState } from 'react'

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
    <div className="flex min-w-0 flex-1 flex-col">
      {duration === undefined
        ? <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
        : <ScheduleTable rowCount={duration + 1} />}
    </div>
  )
}

function ScheduleTable({ rowCount }: { rowCount: number }) {
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

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const periods: number[] = []
  for (let index = first; index < last; index += 1) {
    periods.push(index + 1)
  }

  return (
    <div className="min-w-0 flex-1" ref={wrapperRef}>
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
