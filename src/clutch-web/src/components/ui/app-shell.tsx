import type { ReactNode } from 'react'

type AppShellProps = {
  header: ReactNode
  nav: ReactNode
  children: ReactNode
}

/**
 * The header comes first in the DOM so keyboard order stays header, navigation, content;
 * the header spans the full width and the navigation sits in the left column under it.
 */
export function AppShell({ header, nav, children }: AppShellProps) {
  return (
    <div className="grid min-h-svh grid-cols-[4rem_minmax(0,1fr)] grid-rows-[auto_1fr] bg-canvas">
      <div className="sticky top-0 z-20 col-span-2 row-start-1 min-w-0 bg-canvas">{header}</div>
      <div className="col-start-1 row-start-2">{nav}</div>
      <div className="col-start-2 row-start-2 flex min-w-0">{children}</div>
    </div>
  )
}
