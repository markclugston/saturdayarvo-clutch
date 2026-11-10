export function formatCurrencyAmount(
  amount: string,
  currencyCode: string,
  locale?: string,
): string {
  if (amount.startsWith('-')) {
    return `-${formatUnsignedCurrencyAmount(amount.slice(1), currencyCode, locale)}`
  }

  return formatUnsignedCurrencyAmount(amount, currencyCode, locale)
}

function formatUnsignedCurrencyAmount(
  amount: string,
  currencyCode: string,
  locale?: string,
): string {
  const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(amount)
  const wholePart = match?.[1]
  if (!match || wholePart === undefined) {
    throw new RangeError('The amount is not a valid decimal string.')
  }

  const fractionPart = match[2] ?? ''
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
  })
  const fractionDigits = currencyFormatter.resolvedOptions().minimumFractionDigits
  if (fractionDigits === undefined) {
    throw new RangeError('The currency precision could not be determined.')
  }

  if (fractionPart.length > fractionDigits) {
    throw new RangeError('The amount exceeds the currency precision.')
  }

  const wholeFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const parts = wholeFormatter.formatToParts(BigInt(wholePart))
  if (fractionDigits === 0) {
    return parts.map((part) => part.value).join('')
  }

  const decimalPart = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  }).formatToParts(1.1).find((part) => part.type === 'decimal')?.value
  if (!decimalPart) {
    throw new RangeError('The selected locale has no decimal separator.')
  }

  const paddedFraction = fractionPart.padEnd(fractionDigits, '0')
  const localizedFraction = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: fractionDigits,
    useGrouping: false,
  }).format(BigInt(paddedFraction))
  let finalIntegerPart = -1
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]?.type === 'integer') {
      finalIntegerPart = index
    }
  }

  if (finalIntegerPart < 0) {
    throw new RangeError('The currency amount could not be formatted.')
  }

  return parts
    .map((part, index) =>
      part.value + (index === finalIntegerPart
        ? `${decimalPart}${localizedFraction}`
        : ''),
    )
    .join('')
}
