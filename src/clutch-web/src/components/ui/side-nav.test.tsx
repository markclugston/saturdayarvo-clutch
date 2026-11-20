import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Wallet } from 'lucide-react'
import { expect, it } from 'vitest'
import { SideNav, SideNavItem } from './side-nav'

function renderNav(expanded: boolean) {
  return render(
    <SideNav expanded={expanded}>
      <SideNavItem current expanded={expanded} icon={Wallet} label="Accounts" onClick={() => {}} />
    </SideNav>,
  )
}

it('marks the current item and keeps its name and pointer cursor', () => {
  renderNav(true)
  const item = screen.getByRole('button', { name: 'Accounts' })
  expect(item).toHaveAttribute('aria-current', 'page')
  expect(item.className).toContain('cursor-pointer')
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
})

it('overlays below md and fills its grid column at md and above', () => {
  const { container } = renderNav(true)
  const wrapper = container.firstElementChild as HTMLElement
  const nav = screen.getByRole('navigation', { name: 'Primary' })
  expect(wrapper.className).toContain('w-16')
  expect(wrapper.className).toContain('md:w-full')
  expect(nav.className).toContain('absolute')
  expect(nav.className).toContain('w-40')
  expect(nav.className).toContain('md:w-full')
})

it('keeps the compact width below md when collapsed and hides labels', () => {
  const { container } = renderNav(false)
  const nav = screen.getByRole('navigation', { name: 'Primary' })
  expect(nav.className).toContain('w-16')
  expect(nav.className).not.toContain('w-40')
  expect(nav.className).toContain('md:w-full')
  expect(container.querySelector('span[hidden]')).not.toBeNull()
})

it('shows the label and no tooltip when expanded', async () => {
  const user = userEvent.setup()
  renderNav(true)
  await user.hover(screen.getByRole('button', { name: 'Accounts' }))
  expect(screen.getByText('Accounts')).toBeVisible()
  expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull()
})

it('shows a tooltip with the label when collapsed and focused', async () => {
  const user = userEvent.setup()
  renderNav(false)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Accounts' })).toHaveFocus()
  const popup = await screen.findByText('Accounts', { selector: '[data-slot="tooltip-popup"]' })
  expect(popup).toBeInTheDocument()
})
