import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a text size and a text colour token', () => {
    expect(cn('text-sm', 'text-fg')).toBe('text-sm text-fg')
  })

  it('resolves conflicting token radii', () => {
    expect(cn('rounded-control', 'rounded-card')).toBe('rounded-card')
  })

  it('resolves conflicting token backgrounds', () => {
    expect(cn('bg-card', 'bg-raised')).toBe('bg-raised')
  })

  it('keeps the focus-ring utility next to padding', () => {
    expect(cn('focus-visible:focus-ring', 'p-3')).toBe('focus-visible:focus-ring p-3')
  })
})
