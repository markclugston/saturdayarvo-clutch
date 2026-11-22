import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { isValidElement, useId, type ReactElement } from 'react'

type TooltipProps = {
  /** Short text shown beside the trigger. */
  content: string
  /** The trigger, usually a `Button`. It must accept a ref and spread its props. */
  children: ReactElement<{ 'aria-label'?: string; 'aria-describedby'?: string }>
}

/**
 * A text tooltip for a control. Shows on hover and keyboard focus, stays while the pointer is
 * over it and closes on Escape, blur or pointer leave (WCAG 2.2 SC 1.4.13).
 *
 * The visible tooltip is hidden from assistive technology. When its text equals the trigger's
 * `aria-label` it would repeat the name; otherwise a visually hidden copy describes the trigger
 * through `aria-describedby`, so the description exists even while the tooltip is closed.
 */
function Tooltip({ content, children }: TooltipProps) {
  const descriptionId = useId()
  const label = isValidElement(children) ? children.props['aria-label'] : undefined
  const describes = label !== content

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        aria-describedby={describes ? descriptionId : undefined}
        closeDelay={0}
        delay={300}
        render={children}
      />
      {describes && <span className="sr-only" id={descriptionId}>{content}</span>}
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="z-50" collisionPadding={8} sideOffset={8}>
          <TooltipPrimitive.Popup
            aria-hidden="true"
            className="max-w-xs rounded-control bg-raised px-2.5 py-1.5 text-xs font-medium text-fg shadow-float transition-opacity duration-150 ease-out motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
            data-slot="tooltip-popup"
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip }
