import type { LucideIcon } from 'lucide-react'
import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type SideNavProps = ComponentPropsWithoutRef<'nav'> & { expanded: boolean }

export function SideNav({ expanded, className, children, ...props }: SideNavProps) {
  return (
    <div className="relative h-full w-14 shrink-0 md:w-full">
      <nav
        aria-label="Primary"
        className={cn(
          'absolute inset-y-0 left-0 z-10 flex flex-col gap-2 overflow-hidden bg-canvas p-2 transition-[width] duration-200 ease-in-out md:w-full',
          expanded ? 'w-40' : 'w-14',
          className,
        )}
        {...props}
      >
        {children}
      </nav>
    </div>
  )
}

type SideNavItemProps = {
  icon: LucideIcon
  label: string
  current: boolean
  expanded: boolean
  onClick: () => void
}

export function SideNavItem({ icon: Icon, label, current, expanded, onClick }: SideNavItemProps) {
  // Keep the label rendered while it fades out so collapsing reverses the expand transition.
  const [labelShown, setLabelShown] = useState(expanded)
  useEffect(() => {
    if (expanded) {
      setLabelShown(true)
      return
    }
    const timer = setTimeout(() => setLabelShown(false), 200)
    return () => clearTimeout(timer)
  }, [expanded])

  return (
    <button
      aria-current={current ? 'page' : undefined}
      aria-label={label}
      className={cn(
        'flex cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap rounded-control px-2.5 py-2.5 text-sm',
        expanded ? 'w-full' : 'w-10',
        'font-semibold transition-[width] duration-200 ease-in-out motion-reduce:transition-none hover:bg-hover focus-visible:focus-ring aria-[current=page]:bg-selected aria-[current=page]:text-primary aria-[current=page]:hover:bg-selected',
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span
        aria-hidden="true"
        className={cn(
          'transition-opacity duration-200 ease-in-out motion-reduce:transition-none',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
        style={{ visibility: labelShown ? 'visible' : 'hidden' }}
      >
        {label}
      </span>
    </button>
  )
}
