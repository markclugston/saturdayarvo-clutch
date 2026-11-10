import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { StartupLoadingDialog } from './StartupLoadingDialog'

it('announces the active session check without focusing the message', () => {
  render(<StartupLoadingDialog open />)

  expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
  expect(screen.getByRole('status')).toHaveTextContent('Please wait while we check your session.')
  expect(screen.getByRole('status')).not.toHaveAttribute('tabindex')
  expect(screen.getByRole('status')).not.toHaveFocus()
})

it('cannot be dismissed with Escape or a backdrop press while checking', async () => {
  const user = userEvent.setup()
  render(<StartupLoadingDialog open />)

  await user.keyboard('{Escape}')
  expect(screen.getByRole('status')).toBeInTheDocument()

  const backdrop = document.querySelector('[data-slot="startup-backdrop"]')
  expect(backdrop).not.toBeNull()
  await user.click(backdrop!)
  expect(screen.getByRole('status')).toBeInTheDocument()
})
