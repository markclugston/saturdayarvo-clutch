import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { StartupLoadingDialog } from './StartupLoadingDialog'

it('announces the active session check in a named dialog', () => {
  render(<StartupLoadingDialog open />)

  expect(screen.getByRole('dialog', { name: 'Checking your session' })).toHaveAttribute(
    'aria-describedby',
  )
  expect(screen.getByRole('status')).toHaveTextContent('Please wait while we check your session.')
})

it('cannot be dismissed with Escape or a backdrop press while checking', async () => {
  const user = userEvent.setup()
  render(<StartupLoadingDialog open />)

  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Checking your session' })).toBeInTheDocument()

  const backdrop = document.querySelector('[data-slot="dialog-backdrop"]')
  expect(backdrop).not.toBeNull()
  await user.click(backdrop!)
  expect(screen.getByRole('dialog', { name: 'Checking your session' })).toBeInTheDocument()
})
