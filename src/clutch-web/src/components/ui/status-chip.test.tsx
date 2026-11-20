import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusChip } from './status-chip'

it.each(['danger', 'warning', 'success', 'info', 'neutral'] as const)(
  'renders the required text for %s',
  (status) => {
    render(<StatusChip status={status}>Label {status}</StatusChip>)
    expect(screen.getByText(`Label ${status}`)).toBeInTheDocument()
  },
)

it('hides an optional icon and passes role and id through', () => {
  render(
    <StatusChip icon={<svg data-testid="icon" />} id="chip" role="status" status="warning">
      Possible duplicate
    </StatusChip>,
  )
  const chip = screen.getByRole('status')
  expect(chip).toHaveAttribute('id', 'chip')
  expect(chip).toHaveTextContent('Possible duplicate')
  expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
})
