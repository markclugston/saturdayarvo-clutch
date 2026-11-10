import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

type PageHeadingProps = ComponentPropsWithoutRef<'h1'>

export function PageHeading({ className, ...props }: PageHeadingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.closest('section')?.querySelector<HTMLElement>(
      'button:not(:disabled), input:not(:disabled):not([type="hidden"]):not([type="file"]), select:not(:disabled), textarea:not(:disabled)',
    )?.focus()
  }, [])

  return (
    <h1
      {...props}
      className={className}
      ref={headingRef}
    />
  )
}
