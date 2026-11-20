import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AppShellProps = {
  header: ReactNode
  nav: ReactNode
  /** True while the navigation is expanded; at md and above the nav column widens and content resizes. */
  navExpanded: boolean
  children: ReactNode
}

/**
 * The header comes first in the DOM so keyboard order stays header, navigation, content;
 * the header spans the full width and the navigation sits in the left column under it.
 * Below md the navigation overlays the content; at md and above it widens its column.
 */
export function AppShell({ header, nav, navExpanded, children }: AppShellProps) {
  return (
    <div
      className={cn(
        'grid min-h-svh grid-cols-[4rem_minmax(0,1fr)] grid-rows-[auto_1fr] bg-canvas transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none',
        navExpanded ? 'md:grid-cols-[10rem_minmax(0,1fr)]' : 'md:grid-cols-[4rem_minmax(0,1fr)]',
      )}
    >
      <div className="sticky top-0 z-20 col-span-2 row-start-1 min-w-0 bg-canvas">{header}</div>
      <div className="col-start-1 row-start-2">{nav}</div>
      <div className="col-start-2 row-start-2 flex min-w-0">{children}</div>
    </div>
  )
}
