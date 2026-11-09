import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from 'cn'

type PageHeadingProps = ComponentPropsWithoutRef<'h1'>

export function PageHeading({ className, ...props }: PageHeadingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <h1
      {...props}
      className={cn(
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      ref={headingRef}
      tabIndex={-1}
    />
  )
}
