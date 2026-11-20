import { X } from 'lucide-react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type ChipProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  children: string
  onRemove?: () => void
}

export function Chip({ children, onRemove, className, ...props }: ChipProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-chip bg-raised px-2 py-0.5 text-xs text-fg', className)}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          aria-label={`Remove ${children}`}
          className="inline-flex cursor-pointer rounded-chip hover:bg-hover focus-visible:focus-ring"
          onClick={onRemove}
          type="button"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  )
}
