import { cva } from 'class-variance-authority'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const statusChipVariants = cva(
  'inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        danger: 'bg-danger-bg text-danger',
        warning: 'bg-warning-bg text-warning',
        success: 'bg-success-bg text-success',
        info: 'bg-info-bg text-info',
        neutral: 'bg-neutral-bg text-neutral',
      },
    },
  },
)

type StatusChipProps = ComponentPropsWithoutRef<'span'> & {
  status: 'danger' | 'warning' | 'success' | 'info' | 'neutral'
  icon?: ReactNode
}

export function StatusChip({ status, icon, className, children, ...props }: StatusChipProps) {
  return (
    <span className={cn(statusChipVariants({ status }), className)} {...props}>
      {icon && <span aria-hidden="true" className="inline-flex">{icon}</span>}
      {children}
    </span>
  )
}
