import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { expect, it } from 'vitest'
import { Button } from './button'

it.each(['primary', 'secondary', 'tertiary', 'danger', 'icon'] as const)(
  '%s renders a borderless button with the focus ring',
  (variant) => {
    render(<Button variant={variant}>Go</Button>)
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button.className.split(/\s+/).some((c) => c.startsWith('border'))).toBe(false)
    expect(button.className).toContain('focus-visible:focus-ring')
  },
)

it('passes disabled, type, aria-label and ref through', () => {
  const ref = createRef<HTMLButtonElement>()
  render(<Button aria-label="Close" disabled ref={ref} type="submit" />)
  const button = screen.getByRole('button', { name: 'Close' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('type', 'submit')
  expect(ref.current).toBe(button)
})
