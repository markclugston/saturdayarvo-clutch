import { ChevronDown, CircleAlert } from 'lucide-react'
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

// Every field is the same height as a button (40px) with the same value font size.
const controlClass =
  'peer h-10 w-full rounded-control bg-transparent px-3 pt-[18px] pb-1.5 text-sm leading-4 text-fg placeholder:text-transparent focus-visible:focus-ring'
const selectControlClass = cn(
  controlClass,
  'appearance-none pr-9 [&>option]:bg-raised [&>option]:text-fg',
)
// Text inputs: the label rests in the middle and floats to the top on focus or when filled.
const labelClass =
  'pointer-events-none absolute left-3 top-2.5 origin-left text-sm text-fg-secondary transition-[color,transform] duration-150 ease-out peer-focus:[transform:translateY(-0.5rem)_scale(0.75)] peer-not-placeholder-shown:[transform:translateY(-0.5rem)_scale(0.75)]'
// Selects always show a value, so their label stays small at the top.
const selectLabelClass =
  'pointer-events-none absolute left-3 top-1.5 text-[0.625rem] leading-none text-fg-secondary'

export function FloatingField(props: FloatingFieldProps) {
  const { id, label, error, description, describedBy } = props
  const errorId = error ? `${id}-error` : undefined
  const ariaDescribedBy = [describedBy, description?.id, errorId].filter(Boolean).join(' ') || undefined
  const invalid = error ? true : undefined

  let control: ReactNode
  let wrapperClassName: string | undefined
  let isSelect = false
  if (props.as === 'select') {
    const { as, label: _label, error: _error, description: _description, describedBy: _describedBy, className, children, ...rest } = props
    void [as, _label, _error, _description, _describedBy]
    wrapperClassName = className
    isSelect = true
    control = (
      <select aria-describedby={ariaDescribedBy} aria-invalid={invalid} className={selectControlClass} {...rest}>
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
        {isSelect && (
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-secondary" />
        )}
        <label className={isSelect ? selectLabelClass : labelClass} htmlFor={id}>{label}</label>
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
