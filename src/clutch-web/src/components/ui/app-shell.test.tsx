import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppShell } from './app-shell'

function renderShell(navExpanded: boolean) {
  return render(
    <AppShell
      title="Test title"
      header={<header>Header</header>}
      nav={<nav aria-label="Test nav">Nav</nav>}
      navExpanded={navExpanded}
    >
      <main>Content</main>
    </AppShell>,
  )
}

function gridOf(container: HTMLElement) {
  return container.firstElementChild as HTMLElement
}

it('keeps the compact column at md and above while the navigation is collapsed', () => {
  const { container } = renderShell(false)
  const grid = gridOf(container)
  expect(grid.className).toContain('grid-cols-[3.5rem_minmax(0,1fr)]')
  expect(grid.className).toContain('md:grid-cols-[3.5rem_minmax(0,1fr)]')
  expect(grid.className).not.toContain('md:grid-cols-[10rem_minmax(0,1fr)]')
})

it('widens the navigation column at md and above while expanded, keeping the base overlay width', () => {
  const { container } = renderShell(true)
  const grid = gridOf(container)
  expect(grid.className).toContain('md:grid-cols-[10rem_minmax(0,1fr)]')
  expect(grid.className).not.toContain('md:grid-cols-[3.5rem_minmax(0,1fr)]')
  expect(grid.className.split(/\s+/)).toContain('grid-cols-[3.5rem_minmax(0,1fr)]')
})

it('animates the column change and respects reduced motion', () => {
  const { container } = renderShell(true)
  const classes = gridOf(container).className
  expect(classes).toContain('transition-[grid-template-columns]')
  expect(classes).toContain('duration-200')
  expect(classes).toContain('motion-reduce:transition-none')
})

it('keeps header, navigation and content in DOM order', () => {
  renderShell(true)
  const header = screen.getByText('Header')
  const nav = screen.getByRole('navigation', { name: 'Test nav' })
  const content = screen.getByText('Content')
  expect(header.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(nav.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
