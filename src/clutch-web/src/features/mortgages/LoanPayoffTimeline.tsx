import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import type { LoanPayoffTimelineView } from '@/lib/api/schemas'
import { AmortizationSchedule } from './AmortizationSchedule'
import { BurnDownChart } from './BurnDownChart'
import type { PaymentFrequency } from './repaymentDates'
import { calculateSchedule, type ScheduleInputs } from './scheduleCalculation'

const SWITCH_LABEL: Record<LoanPayoffTimelineView, string> = {
  Burndown: 'Show Amortization Schedule',
  Schedule: 'Show Burndown Chart',
}

const SHOWING: Record<LoanPayoffTimelineView, string> = {
  Burndown: 'Showing Burndown Chart',
  Schedule: 'Showing Amortization Schedule',
}

type LoanPayoffTimelineProps = {
  view: LoanPayoffTimelineView
  /** The switch button was activated; the parent changes `view`. */
  onSwitch: () => void
  /** True for a saved mortgage; a new, unsaved one shows the enter-details prompt. */
  saved: boolean
  /** Saved Duration of the selected mortgage; undefined for a new, unsaved one. */
  duration?: number
  /** Saved Disbursal Date and Payment Frequency of the selected mortgage. */
  disbursalDate?: string
  paymentFrequency?: PaymentFrequency
  /** The Mortgage Account drop-down's current selection; none when undefined. */
  accountId?: string
  /** The form's valid calculation inputs; the Bank Schedule is calculated from them. */
  calculation?: ScheduleInputs
}

/** One card showing the burndown chart or the amortization schedule, with a switch at its top right. */
export function LoanPayoffTimeline({
  view,
  onSwitch,
  saved,
  duration,
  disbursalDate,
  paymentFrequency,
  accountId,
  calculation,
}: LoanPayoffTimelineProps) {
  const schedule = useMemo(
    () => (calculation ? calculateSchedule(calculation) ?? undefined : undefined),
    [calculation],
  )
  const label = SWITCH_LABEL[view]

  return (
    <section aria-labelledby="loan-payoff-timeline-heading" className="flex min-w-0 flex-1 flex-col rounded-card bg-card p-4 xl:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold" id="loan-payoff-timeline-heading">Amortization Schedule</h2>
        <Tooltip content={label}>
          <Button aria-label={label} onClick={onSwitch} size="icon" type="button" variant="icon">
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </Tooltip>
      </div>
      <p className="sr-only" role="status">{SHOWING[view]}</p>
      {view === 'Burndown'
        ? (
          <BurnDownChart
            accountId={accountId}
            disbursalDate={calculation?.disbursalDate}
            duration={calculation?.duration}
            openingBalanceCents={calculation?.openingBalanceCents}
            paymentFrequency={calculation?.paymentFrequency}
            saved={saved}
            schedule={schedule}
          />
        )
        : (
          <AmortizationSchedule
            accountId={accountId}
            disbursalDate={disbursalDate}
            duration={duration}
            paymentFrequency={paymentFrequency}
            schedule={schedule}
          />
        )}
    </section>
  )
}
