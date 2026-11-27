import { useState, type ComponentProps } from 'react'
import { FloatingField } from '@/components/ui/floating-field'

type InputProps = Extract<ComponentProps<typeof FloatingField>, { as?: 'input' }>

const plainNumber = /^\d+(\.\d{0,2})?$|^\.\d{1,2}$/

function group(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.')
  return `${Number(whole).toLocaleString('en-US')}.${fraction.padEnd(2, '0')}`
}

/** `500000.5` -> `$500,000.50`; empty -> `$0`. Anything that is not a plain 2dp number is shown as typed. */
export function formatCurrency(raw: string): string {
  const text = raw.trim()
  if (text === '') {
    return '$0'
  }
  return plainNumber.test(text) ? `$${group(text)}` : raw
}

/** `5.5` -> `5.50%`; empty stays empty. Anything that is not a plain 2dp number is shown as typed. */
export function formatPercent(raw: string): string {
  const text = raw.trim()
  if (text === '' || !plainNumber.test(text)) {
    return raw
  }
  const [whole = '0', fraction = ''] = text.split('.')
  return `${Number(whole)}.${fraction.padEnd(2, '0')}%`
}

/**
 * Restricted entry (WEB-001): drops every character that cannot form a valid value, including pasted
 * symbols ($ , % and spaces), keeps one decimal point and at most `decimals` decimal places (no point
 * at all when 0), so the draft always holds a plain non-negative number and invalid characters never
 * render.
 */
export function clean(value: string, decimals = 2): string {
  const stripped = value.replace(/[^\d.]/g, '')
  const dot = stripped.indexOf('.')
  if (dot === -1) {
    return stripped
  }
  const whole = stripped.slice(0, dot)
  if (decimals === 0) {
    return whole
  }
  const fraction = stripped.slice(dot + 1).replace(/\./g, '').slice(0, decimals)
  return `${whole}.${fraction}`
}

type FormattedNumberFieldProps = Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  format: (raw: string) => string
  onValueChange: (raw: string) => void
  /** Most decimal places that can be typed; 0 for currencies such as JPY. */
  decimals?: number
}

/** Shows the formatted value while idle and the plain number while editing. */
export function FormattedNumberField({
  value,
  format,
  onValueChange,
  onFocus,
  onBlur,
  decimals = 2,
  ...rest
}: FormattedNumberFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <FloatingField
      {...rest}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      onChange={(event) => onValueChange(clean(event.currentTarget.value, decimals))}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      value={focused ? value : format(value)}
    />
  )
}
