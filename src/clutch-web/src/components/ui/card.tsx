import { createElement, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type CardProps = Omit<ComponentPropsWithoutRef<'div'>, 'onSubmit'> & {
  as?: 'section' | 'form' | 'div'
  onSubmit?: ComponentPropsWithoutRef<'form'>['onSubmit']
}

export function Card({ as = 'div', className, ...props }: CardProps) {
  return createElement(as, {
    'data-slot': 'card',
    className: cn('rounded-card bg-card p-3 xl:p-5', className),
    ...props,
  })
}

type CardTitleProps = ComponentPropsWithoutRef<'h2'> & { as: 'h2' | 'h3' }

export function CardTitle({ as: Heading, className, ...props }: CardTitleProps) {
  return <Heading className={cn('text-base font-semibold', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('hairline-t pt-3', className)} {...props} />
}
