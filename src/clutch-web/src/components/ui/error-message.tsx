import { CircleAlert } from 'lucide-react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export function ErrorMessage({
  children,
  className,
  role = 'alert',
  ...props
}: ComponentPropsWithoutRef<'p'>) {
  return (
    <p className={cn('flex items-start gap-2 text-danger', className)} role={role} {...props}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
