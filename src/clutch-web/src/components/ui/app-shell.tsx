import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import logoLight from '@/assets/logo-light.jpg'
import logoDark from '@/assets/logo-dark.jpg'

type AppShellProps = {
  /** Page title, pinned beside the collapsed navigation column so it never moves when the navigation expands. */
  title: string
  header: ReactNode
  nav: ReactNode
  /** True while the navigation is expanded; at md and above the nav column widens and content resizes. */
  navExpanded: boolean
  children: ReactNode
}

/**
 * The header comes first in the DOM so keyboard order stays header, navigation, content;
 * the navigation fills the left column from the top and the header sits above the content.
 * Below md the navigation overlays the content; at md and above it widens its column.
 */
export function AppShell({ title, header, nav, navExpanded, children }: AppShellProps) {
  return (
    <div
      className={cn(
        'grid h-svh grid-cols-[3.5rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-canvas transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none',
        navExpanded ? 'md:grid-cols-[10rem_minmax(0,1fr)]' : 'md:grid-cols-[3.5rem_minmax(0,1fr)]',
      )}
    >
      {/* The page itself never scrolls; only the content panel does, so header, logo, nav and panel corners stay put. */}
      <h1 className="pointer-events-none relative z-30 col-span-2 col-start-1 row-start-1 ml-[4.5rem] min-w-0 overflow-hidden">
        {/* Absolutely positioned so the header row, not the image, sets the height the logo fills; clipped to the header. */}
        {/* The artwork sits ~4% above the image's own centre, so nudge the image down to centre the artwork itself. */}
        <img alt={title} className="absolute left-0 top-[54%] h-full w-auto max-w-none -translate-y-1/2 dark:hidden" src={logoLight} />
        <img alt={title} className="absolute left-0 top-[54%] hidden h-full w-auto max-w-none -translate-y-1/2 dark:block" src={logoDark} />
      </h1>
      <div className="z-20 col-start-2 row-start-1 min-w-0 bg-canvas">{header}</div>
      <div className="col-start-1 row-span-2 row-start-1 min-h-0">{nav}</div>
      <div className="col-start-2 row-start-2 flex min-h-0 min-w-0">{children}</div>
    </div>
  )
}
