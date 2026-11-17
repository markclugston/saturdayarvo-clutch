import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ImportEndedDialog } from './ImportEndedDialog'

it('names the actor as text and requires acknowledgement with trapped keyboard focus', async () => {
  const acknowledge = vi.fn()
  const user = userEvent.setup()
  render(<><button type="button">Outside</button><ImportEndedDialog userName="<script>owner@example.test</script>" onAcknowledge={acknowledge} /></>)
  const dialog = screen.getByRole('dialog', { name: 'Import ended' })
  expect(dialog).toHaveAccessibleDescription(/<script>owner@example.test<\/script>.*another session/)
  expect(dialog.querySelector('script')).toBeNull()
  const button = screen.getByRole('button', { name: 'Return to transactions' })
  await waitFor(() => expect(button).toHaveFocus())
  await user.keyboard('{Tab}')
  await waitFor(() => expect(button).toHaveFocus())
  await user.keyboard('{Shift>}{Tab}{/Shift}{Escape}')
  await waitFor(() => expect(button).toHaveFocus())
  fireEvent.pointerDown(document.body)
  fireEvent.click(document.body)
  expect(screen.getByRole('dialog', { name: 'Import ended' })).toBeVisible()
  expect(acknowledge).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  expect(acknowledge).toHaveBeenCalledTimes(1)
})

it('prevents repeated acknowledgement while navigation is pending', () => {
  render(<ImportEndedDialog userName="owner@example.test" busy onAcknowledge={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Returning to transactions…' })).toBeDisabled()
})
