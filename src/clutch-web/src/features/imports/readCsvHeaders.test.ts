import { describe, expect, it } from 'vitest'
import { readCsvHeaders } from './readCsvHeaders'

describe('readCsvHeaders', () => {
  it('reads only the quoted CSV header record', async () => {
    const file = new File(
      ['Date,"Bank, description",Amount\n2025-01-15,"Card transaction",123.45'],
      'transactions.csv',
      { type: 'text/csv' },
    )

    await expect(readCsvHeaders(file)).resolves.toEqual([
      'Date',
      'Bank, description',
      'Amount',
    ])
  })

  it('rejects empty or malformed headers without returning source content', async () => {
    const file = new File(['"Date,Description\ntransaction,private'], 'invalid.csv')

    await expect(readCsvHeaders(file)).rejects.toThrow('The selected CSV header is invalid.')
  })
})
