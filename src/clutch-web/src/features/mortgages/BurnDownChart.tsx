import { ENTER_DETAILS_MESSAGE } from './AmortizationSchedule'

export const NOT_CALCULATED_CHART_MESSAGE = 'The burn down will appear once the schedule is calculated.'

type BurnDownChartProps = {
  /** True for a saved mortgage; a new, unsaved one shows the enter-details prompt instead. */
  saved: boolean
}

const GUIDES = [60, 110, 160, 210]

/** Skeleton of the balance-over-time chart. No values exist yet, so no line is drawn. */
export function BurnDownChart({ saved }: BurnDownChartProps) {
  return (
    <div className="min-w-0">
      {saved ? (
        <>
          <svg
            aria-label="Line chart of the mortgage balance over time for the Bank schedule. The values have not been calculated yet."
            className="h-auto w-full text-fg-secondary"
            role="img"
            viewBox="0 0 600 300"
          >
            {GUIDES.map((y) => (
              <line
                className="opacity-30"
                key={y}
                stroke="currentColor"
                strokeWidth="1"
                x1="70"
                x2="580"
                y1={y}
                y2={y}
              />
            ))}
            <line stroke="currentColor" strokeWidth="1.5" x1="70" x2="580" y1="260" y2="260" />
            <line stroke="currentColor" strokeWidth="1.5" x1="70" x2="70" y1="30" y2="260" />
            <text
              fill="currentColor"
              fontSize="12"
              textAnchor="middle"
              transform="rotate(-90 20 145)"
              x="20"
              y="145"
            >
              Balance ($)
            </text>
            <text fill="currentColor" fontSize="12" textAnchor="middle" x="325" y="290">
              Repayment Date
            </text>
            <g className="text-primary">
              <line stroke="currentColor" strokeWidth="3" x1="400" x2="424" y1="15" y2="15" />
              <text className="text-fg-secondary" fill="currentColor" fontSize="12" x="430" y="19">
                Bank Schedule
              </text>
            </g>
          </svg>
          <p className="mt-2 text-sm text-fg-secondary">{NOT_CALCULATED_CHART_MESSAGE}</p>
        </>
      ) : (
        <p className="text-sm text-fg-secondary">{ENTER_DETAILS_MESSAGE}</p>
      )}
    </div>
  )
}
