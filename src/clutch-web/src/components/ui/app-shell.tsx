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

type LogoCropProps = {
  title: string
  /** Size and background scale of the crop, shared by both themes. */
  className: string
  lightPosition: string
  darkPosition: string
}

/** logo.svg stacks the light-theme logo (top) over the dark-theme logo (bottom) in one 1536x1024 image. */
function LogoCrop({ title, className, lightPosition, darkPosition }: LogoCropProps) {
  return (
    <>
      <div
        aria-label={title}
        className={cn('bg-no-repeat dark:hidden', className, lightPosition)}
        role="img"
        style={{ backgroundImage: `url(${logo})` }}
      />
      <div
        aria-label={title}
        className={cn('hidden bg-no-repeat dark:block', className, darkPosition)}
        role="img"
        style={{ backgroundImage: `url(${logo})` }}
      />
    </>
  )
}

/**
 * The header comes first in the DOM so keyboard order stays header, navigation, content.
 * The logo and the header share the top row side by side, so neither can cover the other, and the
 * navigation fills the left column beneath the logo. Below md only the logo's C mark shows, in a slot
 * as wide as the collapsed navigation column (WCAG 2.2 SC 1.4.10 reflow).
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
      <div className="z-20 col-span-2 col-start-1 row-start-1 flex min-w-0 items-start bg-canvas">
        {/* The logo has a fixed height at each width, so a taller header (wrapped controls, an error message) never enlarges it. */}
        <h1 className="flex w-14 shrink-0 justify-center md:w-auto md:justify-start md:pl-2">
          {/* Below md: a 131x150 window on the C mark (measured): from x 43, y 262 (light) and x 45, y 578 (dark). Level with the first row of header controls. */}
          <span className="mt-[18px] md:hidden">
            <LogoCrop
              className="aspect-[131/150] h-10 bg-[length:1172.52%_682.67%]"
              darkPosition="bg-[position:3.2%_66.13%]"
              lightPosition="bg-[position:3.06%_29.98%]"
              title={title}
            />
          </span>
          {/* At md and above: a 1356x200 window centred vertically on the C mark and wordmark (measured): x 46-1402, y 237-437 (light) and 553-753 (dark). */}
          {/* At md it is level with the header controls. At lg it has 8px above it and reaches 4px into the content panel's 12px top margin. */}
          <span className="mt-[18px] hidden md:block lg:-mb-1 lg:mt-2">
            <LogoCrop
              className="aspect-[1356/200] h-10 bg-[length:113.27%_512%] lg:h-[3.75rem]"
              darkPosition="bg-[position:25.56%_67.11%]"
              lightPosition="bg-[position:25.56%_28.76%]"
              title={title}
            />
          </span>
        </h1>
        <div className="min-w-0 flex-1">{header}</div>
      </div>
      <div className="col-start-1 row-start-2 min-h-0">{nav}</div>
      <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col">{children}</div>
    </div>
  )
}
