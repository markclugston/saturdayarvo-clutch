import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export function ContentPanel({ className, children, ...props }: ComponentPropsWithoutRef<'main'>) {
  return (
    <main
      className={cn('m-2 min-w-0 flex-1 rounded-panel bg-content p-4 lg:m-3 xl:p-6', className)}
      {...props}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </main>
  )
}
