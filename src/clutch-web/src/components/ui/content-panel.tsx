import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type ContentPanelProps = ComponentPropsWithoutRef<'main'> & {
  /** Let the content use the full panel width instead of the readable max width. */
  wide?: boolean
}

export function ContentPanel({ className, children, wide = false, ...props }: ContentPanelProps) {
  return (
    <main
      className={cn('m-2 min-h-0 min-w-0 flex-1 overflow-y-auto rounded-panel bg-content p-4 lg:m-3 xl:p-6', className)}
      {...props}
    >
      <div className={cn('mx-auto w-full', !wide && 'max-w-5xl')}>{children}</div>
    </main>
  )
}
