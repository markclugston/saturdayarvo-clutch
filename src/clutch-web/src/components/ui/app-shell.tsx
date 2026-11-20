import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.svg'

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
 * the logo spans the top row from the left edge and the navigation fills the left column beneath it.
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
      <h1 className="pointer-events-none relative z-30 col-span-2 col-start-1 row-start-1 min-w-0 overflow-x-clip">
        {/* logo.svg stacks the light-theme logo (top) over the dark-theme logo (bottom) in one 1536x1024 image. */}
        {/* Each logo is shown by cropping a 1356x200 window centred vertically on the C mark and wordmark (measured): x 46-1402, y 237-437 (light) and 553-753 (dark). */}
        {/* Absolutely positioned with 8px above and below measured against the whole header zone (the header row plus the content panel top margin, 8px below lg and 12px at lg, hence the bottom offsets) so the logo is centred with the header controls; its left edge lines up with the nav buttons (8px). */}
        <div
          aria-label={title}
          className="absolute bottom-0 left-2 top-2 lg:-bottom-1 aspect-[1356/200] bg-[length:113.27%_512%] bg-[position:25.56%_28.76%] bg-no-repeat dark:hidden"
          role="img"
          style={{ backgroundImage: `url(${logo})` }}
        />
        <div
          aria-label={title}
          className="absolute bottom-0 left-2 top-2 lg:-bottom-1 hidden aspect-[1356/200] bg-[length:113.27%_512%] bg-[position:25.56%_67.11%] bg-no-repeat dark:block"
          role="img"
          style={{ backgroundImage: `url(${logo})` }}
        />
      </h1>
      <div className="z-20 col-start-2 row-start-1 min-w-0 bg-canvas">{header}</div>
      <div className="col-start-1 row-start-2 min-h-0">{nav}</div>
      <div className="col-start-2 row-start-2 flex min-h-0 min-w-0">{children}</div>
    </div>
  )
}
