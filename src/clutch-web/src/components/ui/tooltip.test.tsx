import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from './button'
import { Tooltip } from './tooltip'

function renderTooltip(content: string, label: string) {
  return render(
    <>
      <Tooltip content={content}>
        <Button aria-label={label} size="icon" type="button" variant="icon">x</Button>
      </Tooltip>
      <Button type="button">Elsewhere</Button>
    </>,
  )
}

const tooltip = () => screen.queryByText('Show Schedule', { selector: '[data-slot="tooltip-popup"]' })

describe('Tooltip', () => {
  // Moving the pointer from the trigger onto the tooltip needs real layout (jsdom has none), so
  // that path is covered by the style-guide browser test; here the popup must accept the pointer.
  it('shows on hover, accepts the pointer while open, and hides on pointer leave', async () => {
    const user = userEvent.setup()
    renderTooltip('Show Schedule', 'Show Schedule')
    const trigger = screen.getByRole('button', { name: 'Show Schedule' })

    await user.hover(trigger)
    const popup = await screen.findByText('Show Schedule', { selector: '[data-slot="tooltip-popup"]' })
    expect((popup.parentElement as HTMLElement).style.pointerEvents).not.toBe('none')

    await user.unhover(trigger)
    await user.hover(screen.getByRole('button', { name: 'Elsewhere' }))
    await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
  })

  it('shows on keyboard focus and hides on blur', async () => {
    const user = userEvent.setup()
    renderTooltip('Show Schedule', 'Show Schedule')

    await user.tab()
    expect(screen.getByRole('button', { name: 'Show Schedule' })).toHaveFocus()
    expect(await screen.findByText('Show Schedule', { selector: '[data-slot="tooltip-popup"]' })).toBeInTheDocument()

    await user.tab()
    await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
  })

  it('hides on Escape and keeps focus on the trigger', async () => {
    const user = userEvent.setup()
    renderTooltip('Show Schedule', 'Show Schedule')

    await user.tab()
    await screen.findByText('Show Schedule', { selector: '[data-slot="tooltip-popup"]' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Show Schedule' })).toHaveFocus()
  })

  it('is hidden from assistive technology when its text is the trigger’s accessible name', async () => {
    const user = userEvent.setup()
    renderTooltip('Show Schedule', 'Show Schedule')
    const trigger = screen.getByRole('button', { name: 'Show Schedule' })

    await user.hover(trigger)
    const popup = await screen.findByText('Show Schedule', { selector: '[data-slot="tooltip-popup"]' })

    expect(popup).toHaveAttribute('aria-hidden', 'true')
    expect(trigger).not.toHaveAttribute('aria-describedby')
    expect(trigger).toHaveAccessibleName('Show Schedule')
    expect(trigger).not.toHaveAccessibleDescription()
  })

  it('describes the trigger when its text differs from the accessible name', () => {
    renderTooltip('Show Schedule', 'Switch')
    const trigger = screen.getByRole('button', { name: 'Switch' })

    expect(trigger).toHaveAttribute('aria-describedby')
    expect(trigger).toHaveAccessibleDescription('Show Schedule')
  })

  it('uses tokens only and turns its motion off under reduced motion', async () => {
    const user = userEvent.setup()
    renderTooltip('Show Schedule', 'Show Schedule')

    await user.hover(screen.getByRole('button', { name: 'Show Schedule' }))
    const popup = await screen.findByText('Show Schedule', { selector: '[data-slot="tooltip-popup"]' })

    const classes = popup.className.split(/\s+/)
    for (const expected of ['bg-raised', 'text-fg', 'rounded-control', 'shadow-float', 'transition-opacity', 'duration-150', 'ease-out', 'motion-reduce:transition-none']) {
      expect(classes).toContain(expected)
    }
  })
})
