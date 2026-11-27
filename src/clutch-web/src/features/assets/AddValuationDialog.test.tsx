import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddValuationDialog } from './AddValuationDialog'
import { addValuation, emptyAssetDraft } from './assetDraft'
import { currencies, money } from './testSupport'

const aud = currencies[0]!
const yen = currencies[1]!

describe('AddValuationDialog', () => {
  const onAdd = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => vi.resetAllMocks())

  function open(currency = aud) {
    const draft = addValuation({ ...emptyAssetDraft(), currencyCode: currency.code }, '1', '2026-01-01')
    render(<AddValuationDialog currency={currency} draft={draft} onAdd={onAdd} onClose={onClose} />)
    return userEvent.setup()
  }

  const value = () => screen.getByLabelText('Value')
  const date = () => screen.getByLabelText('Valuation Date')
  const ok = () => screen.getByRole('button', { name: 'OK' })

  it('adds the valuation to the draft only, and closes', async () => {
    const user = open()

    await user.type(value(), '1250.5')
    await user.type(date(), '2026-02-01')
    await user.click(ok())

    expect(onAdd).toHaveBeenCalledWith('1250.5', '2026-02-01')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('discards on Cancel', async () => {
    const user = open()
    await user.type(value(), '5')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it.each([
    ['', '2026-02-01', 'Enter a value'],
    ['1000000000000', '2026-02-01', 'Enter a value up to 999,999,999,999.99'],
    ['1', '', 'Enter a valid date'],
    ['1', '9999-01-01', 'Enter a date that is not in the future'],
    ['1', '2026-01-01', 'This valuation date is already used'],
  ])('shows a field error for value %j on %j', async (typed, on, message) => {
    const user = open()

    if (typed) await user.type(value(), typed)
    if (on) await user.type(date(), on)
    await user.click(ok())

    expect(screen.getByText(message)).toBeInTheDocument()
    const invalid = message.includes('date') ? date() : value()
    expect(invalid).toHaveAttribute('aria-invalid', 'true')
    expect(onAdd).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('never shows a negative sign or letters, so a negative value cannot be entered', async () => {
    const user = open()

    await user.type(value(), '-12a.5')
    expect(value()).toHaveValue('12.5')
  })

  it('formats the value in the asset currency when focus leaves it', async () => {
    const user = open()

    await user.type(value(), '1250.5')
    await user.tab()

    expect(value()).toHaveValue(money(1250.5, 'AUD'))
    expect(value()).toHaveClass('text-right', 'tabular-nums')
  })

  it('takes no decimals for yen', async () => {
    const user = open(yen)

    await user.type(value(), '5000.75')
    expect(value()).toHaveValue('500075')
    await user.clear(value())
    await user.paste('1,234.')
    expect(value()).toHaveValue('1234')
    await user.tab()

    expect(value()).toHaveValue(money(1234, 'JPY'))
  })
})
