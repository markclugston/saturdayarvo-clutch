import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { AuthPage } from './AuthPage'

it('describes the password requirements when creating an account', async () => {
  const user = userEvent.setup()
  renderWithQueryClient(<AuthPage />)

  expect(screen.getByLabelText('Password')).not.toHaveAccessibleDescription()
  await user.click(screen.getByRole('button', { name: 'New Here? Create an Account' }))

  expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
    'Use at least 12 characters, including an uppercase letter, a lowercase letter, a number, and a symbol.',
  )

  await user.click(screen.getByRole('button', { name: 'Already Registered? Sign In' }))
  expect(screen.getByLabelText('Password')).not.toHaveAccessibleDescription()
})
