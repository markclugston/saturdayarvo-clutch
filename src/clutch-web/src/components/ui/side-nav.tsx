import type { LucideIcon } from 'lucide-react'
import { useState, type ComponentPropsWithoutRef } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type SideNavProps = ComponentPropsWithoutRef<'nav'> & { expanded: boolean }

export function SideNav({ expanded, className, children, ...props }: SideNavProps) {
  return (
    <div className="relative h-full w-16 shrink-0">
      <nav
        aria-label="Primary"
        className={cn(
          'absolute inset-y-0 left-0 z-10 flex flex-col gap-2 overflow-hidden bg-canvas p-2 transition-[width] duration-200 ease-in-out',
          expanded ? 'w-40' : 'w-16',
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
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  // While the navigation is collapsed (including after Escape dismisses it), a focused or
  // hovered item names itself with a tooltip.
  const showTooltip = !expanded && (focused || hovered)

  return (
    <Tooltip label={label} open={showTooltip}>
      <button
        aria-current={current ? 'page' : undefined}
        aria-label={label}
        className="flex w-full cursor-pointer items-center gap-2 rounded-control px-2.5 py-2.5 text-sm font-semibold transition-colors hover:bg-hover focus-visible:focus-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-contrast"
        onBlur={() => setFocused(false)}
        onClick={onClick}
        onFocus={(event) => setFocused(isFocusVisible(event.currentTarget))}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }}
        onPointerLeave={() => setHovered(false)}
        type="button"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span className="transition-opacity duration-200" hidden={!expanded}>{label}</span>
      </button>
    </Tooltip>
  )
}

function isFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}
