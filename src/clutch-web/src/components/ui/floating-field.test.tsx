import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { FloatingField } from './floating-field'

it('names the control with its label', () => {
  render(<FloatingField id="email" label="Email" />)
  expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
})

it('floats the label on focus and keeps it floated when the field has a value, at the select height', async () => {
  const user = userEvent.setup()
  render(<FloatingField id="email" label="Email" />)
  const input = screen.getByLabelText('Email')
  const label = screen.getByText('Email')
  expect(label.className).toContain('peer-focus:')
  expect(label.className).toContain('peer-not-placeholder-shown:')
  expect(input).toHaveAttribute('placeholder', ' ')
  expect(input.className).toContain('h-10')
  expect(input.className).toContain('text-sm')

  await user.click(input)
  expect(input).toHaveFocus()
  await user.type(input, 'a')
  expect(input).toHaveValue('a')
})

it('merges describedBy, description and error ids', () => {
  render(
    <FloatingField
      describedBy="extra"
      description={{ id: 'help', text: 'Helper text' }}
      error="Bad value"
      id="name"
      label="Name"
    />,
  )
  const input = screen.getByLabelText('Name')
  expect(input.getAttribute('aria-describedby')).toBe('extra help name-error')
  expect(screen.getByText('Helper text')).toHaveAttribute('id', 'help')
})

it('sets aria-invalid only with an error and renders text plus a hidden icon', () => {
  const { rerender } = render(<FloatingField id="name" label="Name" />)
  expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')

  rerender(<FloatingField error="Required" id="name" label="Name" />)
  expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
  const message = screen.getByText('Required')
  expect(message).toBeInTheDocument()
  expect(message.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

it('renders a select', () => {
  render(
    <FloatingField as="select" id="currency" label="Currency">
      <option value="AUD">AUD</option>
    </FloatingField>,
  )
  expect(screen.getByRole('combobox', { name: 'Currency' })).toBeInTheDocument()
})
