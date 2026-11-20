import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type { ReactElement } from 'react'

type TooltipProps = {
  label: string
  children: ReactElement<Record<string, unknown>>
  disabled?: boolean
  open?: boolean
}

export function Tooltip({ label, children, disabled = false, open }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delay={0}>
      <TooltipPrimitive.Root disabled={disabled} open={open}>
        <TooltipPrimitive.Trigger render={children} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner side="right" sideOffset={8}>
            <TooltipPrimitive.Popup
              className="z-50 rounded-chip bg-neutral-strong px-2 py-1 text-xs text-neutral-strong-contrast shadow-float"
              data-slot="tooltip-popup"
            >
              {label}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
