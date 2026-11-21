import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FolderTree, Landmark, Wallet } from 'lucide-react'
import { expect, it, vi } from 'vitest'
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
  expect(wrapper.className).toContain('w-14')
  expect(wrapper.className).toContain('md:w-full')
  expect(nav.className).toContain('absolute')
  expect(nav.className).toContain('w-40')
  expect(nav.className).toContain('md:w-full')
})

it('keeps the compact width below md when collapsed and hides labels', () => {
  renderNav(false)
  const nav = screen.getByRole('navigation', { name: 'Primary' })
  expect(nav.className).toContain('w-14')
  expect(nav.className).not.toContain('w-40')
  expect(nav.className).toContain('md:w-full')
  expect(screen.getByText('Accounts')).not.toBeVisible()
})

it('shows the label and no tooltip when expanded', async () => {
  const user = userEvent.setup()
  renderNav(true)
  await user.hover(screen.getByRole('button', { name: 'Accounts' }))
  expect(screen.getByText('Accounts')).toBeVisible()
  expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull()
})

it('shows no tooltip when collapsed and hovered or focused', async () => {
  const user = userEvent.setup()
  renderNav(false)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Accounts' })).toHaveFocus()
  await user.hover(screen.getByRole('button', { name: 'Accounts' }))
  expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull()
})

it('lists a Mortgages destination directly above Categories and marks only the current one', async () => {
  const user = userEvent.setup()
  const onMortgages = vi.fn()
  render(
    <SideNav expanded>
      <SideNavItem current={false} expanded icon={Wallet} label="Accounts" onClick={() => {}} />
      <SideNavItem current expanded icon={Landmark} label="Mortgages" onClick={onMortgages} />
      <SideNavItem current={false} expanded icon={FolderTree} label="Categories" onClick={() => {}} />
    </SideNav>,
  )

  const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
  expect(names).toEqual(['Accounts', 'Mortgages', 'Categories'])
  expect(screen.getByRole('button', { name: 'Mortgages' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Categories' })).not.toHaveAttribute('aria-current')
  await user.click(screen.getByRole('button', { name: 'Mortgages' }))
  expect(onMortgages).toHaveBeenCalledTimes(1)
})
