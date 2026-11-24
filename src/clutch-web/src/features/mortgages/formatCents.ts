import { formatCurrency } from './FormattedNumberField'

/**
 * 49950225 cents -> "$499,502.25". The one format for Bank Schedule amounts, shared by the Amortization Schedule's
 * closing balance and the Burndown's label and text alternative so they always match (FR-007).
 */
export function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100)
  const remainder = String(cents % 100).padStart(2, '0')
  return formatCurrency(`${whole}.${remainder}`)
}
