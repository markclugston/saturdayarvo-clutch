import { afterEach, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '@/lib/api/client'
import {
  confirmImportReview,
  createImportReview,
  getAccountImportSettings,
  type ImportMapping,
} from './api'

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

it.each([
  { mapping: null },
  { mapping },
])('retrieves a validated account settings response: %j', async (settings) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(settings)))

  await expect(getAccountImportSettings(accountId)).resolves.toEqual(settings)
})

it('preserves a settings retrieval problem as an ApiError', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    status: 500,
    title: 'Saved import settings could not be read.',
  }, { status: 500, headers: { 'Content-Type': 'application/problem+json' } })))

  await expect(getAccountImportSettings(accountId)).rejects.toMatchObject({
    name: 'ApiError',
    status: 500,
  })
})

it('rejects malformed saved settings instead of treating them as empty', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ mapping: { dateColumn: -1 } })))

  await expect(getAccountImportSettings(accountId)).rejects.toThrow('invalid response')
})

it('parses the separate defaults-save outcome from a successful confirmation', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/security/csrf-token') {
      return Response.json({ requestToken: 'token' })
    }

    return Response.json({
      importedCount: 1,
      completedAtUtc: '2025-01-15T13:50:00.000Z',
      settingsSaved: false,
    })
  }))

  await expect(confirmImportReview(reviewId, false)).resolves.toEqual({
    importedCount: 1,
    completedAtUtc: '2025-01-15T13:50:00.000Z',
    settingsSaved: false,
  })
})
