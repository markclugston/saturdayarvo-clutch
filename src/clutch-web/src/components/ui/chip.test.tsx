import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Chip } from './chip'

it('has no remove button without onRemove', () => {
  render(<Chip>Groceries</Chip>)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('calls onRemove once from a button named Remove with the label', async () => {
  const onRemove = vi.fn()
  render(<Chip onRemove={onRemove}>Groceries</Chip>)
  await userEvent.click(screen.getByRole('button', { name: 'Remove Groceries' }))
  expect(onRemove).toHaveBeenCalledTimes(1)
})
