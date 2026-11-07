import { afterEach, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '@/lib/api/client'
import { createImportReview, type ImportMapping } from './api'

const reviewId = '550e8400-e29b-41d4-a716-446655440002'
const accountId = '550e8400-e29b-41d4-a716-446655440000'
const mapping: ImportMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  dateFormat: 'yyyy-MM-dd',
  amountMode: 'Signed',
  signedAmountColumn: 2,
  incomingSign: 'Positive',
  numberFormat: 'dot-decimal-comma-grouping',
}

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
})

it.each([204, 500])('cancels the specific review after an invalid 201 response (cleanup %s)', async (cleanupStatus) => {
  const requests: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    requests.push(`${init?.method ?? 'GET'} ${path}`)
    if (path === '/api/security/csrf-token') {
      return Response.json({ requestToken: 'token' })
    }
    if (path === `/api/accounts/${accountId}/import-reviews`) {
      return Response.json({ invalid: true }, {
        status: 201,
        headers: { Location: `/api/import-reviews/${reviewId}` },
      })
    }
    if (path === `/api/import-reviews/${reviewId}`) {
      return cleanupStatus === 204
        ? new Response(null, { status: 204 })
        : Response.json({ title: 'Cleanup failed' }, { status: 500 })
    }
    throw new Error(`Unexpected request: ${path}`)
  }))

  await expect(createImportReview(accountId, new File(['csv'], 'file.csv'), mapping))
    .rejects.toThrow(cleanupStatus === 204 ? 'invalid response' : 'could not be cancelled')
  expect(requests).toContain(`DELETE /api/import-reviews/${reviewId}`)
})

it('does not cancel an arbitrary location from an invalid response', async () => {
  const requests: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    requests.push(path)
    if (path === '/api/security/csrf-token') {
      return Response.json({ requestToken: 'token' })
    }
    return Response.json({}, { status: 201, headers: { Location: '/api/import-reviews/not-a-guid' } })
  }))

  await expect(createImportReview(accountId, new File(['csv'], 'file.csv'), mapping))
    .rejects.toThrow('invalid response')
  expect(requests).toHaveLength(2)
})
