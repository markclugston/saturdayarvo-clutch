import { CircleAlert } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FieldCommon = {
  id: string
  label: string
  error?: string
  description?: { id: string; text: string }
  describedBy?: string
}

type InputFieldProps = FieldCommon
  & Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'children'>
  & { as?: 'input' }

type SelectFieldProps = FieldCommon
  & Omit<ComponentPropsWithoutRef<'select'>, 'id'>
  & { as: 'select'; children: ReactNode }

type FloatingFieldProps = InputFieldProps | SelectFieldProps

const controlClass =
  'peer h-14 w-full rounded-control bg-transparent px-3 pt-5 pb-1.5 text-fg placeholder:text-transparent focus-visible:focus-ring'
const labelClass =
  'pointer-events-none absolute left-3 top-4 origin-left text-sm text-fg-secondary transition-[color,transform] duration-150 ease-out peer-focus:[transform:translateY(-0.625rem)_scale(0.75)] peer-not-placeholder-shown:[transform:translateY(-0.625rem)_scale(0.75)]'

export function FloatingField(props: FloatingFieldProps) {
  const { id, label, error, description, describedBy } = props
  const errorId = error ? `${id}-error` : undefined
  const ariaDescribedBy = [describedBy, description?.id, errorId].filter(Boolean).join(' ') || undefined
  const invalid = error ? true : undefined

  let control: ReactNode
  let wrapperClassName: string | undefined
  if (props.as === 'select') {
    const { as, label: _label, error: _error, description: _description, describedBy: _describedBy, className, children, ...rest } = props
    void [as, _label, _error, _description, _describedBy]
    wrapperClassName = className
    control = (
      <select aria-describedby={ariaDescribedBy} aria-invalid={invalid} className={controlClass} {...rest}>
        {children}
      </select>
    )
  } else {
    const { as, label: _label, error: _error, description: _description, describedBy: _describedBy, className, ...rest } = props
    void [as, _label, _error, _description, _describedBy]
    wrapperClassName = className
    control = (
      <input
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid}
        className={controlClass}
        placeholder=" "
        {...rest}
      />
    )
  }

  return (
    <div className={cn('min-w-0', wrapperClassName)}>
      <div className="relative rounded-control bg-raised">
        {control}
        <label className={labelClass} htmlFor={id}>{label}</label>
      </div>
      {description && (
        <p className="mt-1 px-1 text-xs text-fg-secondary" id={description.id}>{description.text}</p>
      )}
      {error && (
        <p className="mt-1 flex items-start gap-2 px-1 text-xs text-danger" id={errorId}>
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
