import { Feather, LoaderCircle, Trash2 } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { usePinnedList } from '@/lib/usePinnedList'
import { cn } from '@/lib/utils'

// The list standard (clutch-ui-style §12). Every list is built from these parts.

type ListRegionProps = ComponentPropsWithRef<'div'> & {
  label: string
  /** `page`: the page's scroll moves the rows (`usePinnedList`). `self`: the region scrolls, as in a dialog. */
  scroll: 'page' | 'self'
}

/** The labelled, keyboard-focusable area holding a list's rows. */
export function ListRegion({ label, scroll, className, ...props }: ListRegionProps) {
  return (
    <div
      aria-label={label}
      // Positioned, so screen-reader-only text far along a wide table scrolls with it.
      className={cn(
        'relative rounded-control focus-visible:focus-ring',
        scroll === 'page' ? 'overflow-x-auto overflow-y-hidden [overflow-anchor:none]' : 'overflow-auto',
        className,
      )}
      role="region"
      tabIndex={0}
      {...props}
    />
  )
}

type ListCardProps = {
  /** Names the region holding the rows. */
  label: string
  /** The table. */
  children: ReactNode
  /** Stays in the card above the rows while they move. */
  title?: ReactNode
  /** Reached after the last row. Pass `null` while there is nothing, so the table is not remounted. */
  end?: ReactNode
  /** Shown instead of the rows, keeping the card and its title. */
  empty?: ReactNode
  as?: 'div' | 'section'
  className?: string
  'aria-labelledby'?: string
}

/** A list's card: it stops at the top of the content panel while the page's scroll moves its rows. */
export function ListCard({ label, children, title, end, empty, className, ...card }: ListCardProps) {
  const { trackRef, listRef, spacerRef } = usePinnedList()
  const hasEnd = Boolean(end)

  return (
    <div className="min-w-0 [overflow-anchor:none]" ref={trackRef}>
      <Card {...card} className={cn('sticky top-0 min-w-0', Boolean(title) && 'space-y-3', className)}>
        {title}
        {empty ?? (
          // The extra room keeps the focus ring of what follows the rows from being clipped.
          <ListRegion className={cn(hasEnd && '-mx-1 -mb-1 px-1')} label={label} ref={listRef} scroll="page">
            {end === undefined
              ? children
              : (
                <div className={cn('w-fit min-w-full', hasEnd && 'pb-1')}>
                  {children}
                  {hasEnd && <div className="sticky left-0 w-fit space-y-3 pt-3">{end}</div>}
                </div>
              )}
          </ListRegion>
        )}
      </Card>
      <div aria-hidden="true" ref={spacerRef} />
    </div>
  )
}

export function ListTable({ caption, className, children, ...props }: ComponentPropsWithRef<'table'> & { caption: string }) {
  return (
    <table className={cn('w-full text-left text-sm', className)} {...props}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  )
}

export function ListHead({ className, ...props }: ComponentPropsWithRef<'thead'>) {
  return <thead className={cn('sticky top-0 z-10 bg-raised', className)} {...props} />
}

export function ListBody({ className, ...props }: ComponentPropsWithRef<'tbody'>) {
  // Isolated, so a focused button's stacking order cannot lift it above the header.
  return <tbody className={cn('isolate', className)} {...props} />
}

export function ListRow({ className, ...props }: ComponentPropsWithRef<'tr'>) {
  return <tr className={cn('hairline-b', className)} {...props} />
}

export function ListHeaderCell({ numeric = false, className, ...props }: ComponentPropsWithRef<'th'> & { numeric?: boolean }) {
  return <th className={cn('px-3 py-2', numeric && 'text-right', className)} scope="col" {...props} />
}

export function ListCell({ numeric = false, className, ...props }: ComponentPropsWithRef<'td'> & { numeric?: boolean }) {
  return (
    <td className={cn('px-3 py-2', numeric && 'whitespace-nowrap text-right tabular-nums', className)} {...props} />
  )
}

export function ListActionsHeader() {
  return (
    <ListHeaderCell className="text-right">
      <span className="sr-only">Actions</span>
    </ListHeaderCell>
  )
}

export function ListActionsCell({ className, ...props }: ComponentPropsWithRef<'td'>) {
  return <ListCell className={cn('whitespace-nowrap text-right', className)} {...props} />
}

type RowButtonProps = Omit<ComponentPropsWithRef<typeof Button>, 'aria-label' | 'children' | 'size' | 'variant'> & {
  /** The accessible name; it identifies the row. */
  label: string
}

export function EditButton({ label, ...props }: RowButtonProps) {
  return (
    <Button aria-label={label} size="icon" type="button" variant="tertiary" {...props}>
      <Feather aria-hidden="true" className="size-4" />
    </Button>
  )
}

export function DeleteButton({ label, ...props }: RowButtonProps) {
  return (
    <Button aria-label={label} size="icon" type="button" variant="tertiary" {...props}>
      <Trash2 aria-hidden="true" className="size-4 text-danger" />
    </Button>
  )
}

export function ListLoading({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" className="flex items-center gap-3 text-fg-secondary" role="status">
      <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
      <p>{children}</p>
    </div>
  )
}

export function ListLoadError({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <ErrorMessage>{children}</ErrorMessage>
      <Button onClick={onRetry} type="button" variant="secondary">
        Retry
      </Button>
    </div>
  )
}

type ListEmptyProps = {
  children: ReactNode
  title?: ReactNode
  as?: 'div' | 'section'
  'aria-labelledby'?: string
}

export function ListEmpty({ children, title, ...card }: ListEmptyProps) {
  return (
    <Card {...card} className={cn(Boolean(title) && 'space-y-3')}>
      {title}
      <p className="text-fg-secondary">{children}</p>
    </Card>
  )
}
