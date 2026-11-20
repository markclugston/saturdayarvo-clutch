import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ErrorMessage } from './error-message'

it('renders its text as an alert by default', () => {
  render(<ErrorMessage>Something failed</ErrorMessage>)
  expect(screen.getByRole('alert')).toHaveTextContent('Something failed')
})

it('accepts another role and an id', () => {
  render(<ErrorMessage id="err" role="status">Heads up</ErrorMessage>)
  expect(screen.getByRole('status')).toHaveAttribute('id', 'err')
})

it('hides the icon from assistive technology', () => {
  render(<ErrorMessage>Oops</ErrorMessage>)
  expect(screen.getByRole('alert').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
