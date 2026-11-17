import { afterEach, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '@/lib/api/client'
import {
  confirmImportReview,
  cancelActiveImportReview,
  createImportReview,
  getAccountImportSettings,
  getImportStatus,
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

const available = { accountId, availability: 'Available', activeImport: null, watchedImport: null }
const expiresAtUtc = '2026-11-17T09:00:00Z'

it.each([
  available,
  ...(['Preview', 'Processing', 'Unknown'] as const).map((stage) => ({
    ...available, availability: 'Blocked',
    activeImport: { id: reviewId, stage, canEnd: stage === 'Preview', expiresAtUtc: stage === 'Preview' ? expiresAtUtc : null },
  })),
])('reads validated availability: %j', async (status) => {
  const controller = new AbortController()
  const fetchMock = vi.fn(async () => Response.json(status))
  vi.stubGlobal('fetch', fetchMock)
  await expect(getImportStatus(accountId, undefined, controller.signal)).resolves.toEqual(status)
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/accounts/${accountId}/import-status`,
    expect.objectContaining({ signal: controller.signal, cache: 'no-store' }),
  )
})

it.each([
  { id: reviewId, state: 'Ready', expiresAtUtc },
  { id: reviewId, state: 'Processing' },
  { id: reviewId, state: 'Ended', endedAtUtc: expiresAtUtc, endedBy: { userId: 'owner', userName: 'owner@example.test' } },
  { id: reviewId, state: 'Expired' },
  { id: reviewId, state: 'Unavailable' },
])('reads the exact watched state: %j', async (watchedImport) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...available, watchedImport })))
  await expect(getImportStatus(accountId, reviewId)).resolves.toMatchObject({ watchedImport })
})

it.each([
  { ...available, activeImport: { id: reviewId, stage: 'Preview', canEnd: true, expiresAtUtc } },
  { ...available, availability: 'Blocked' },
  { ...available, availability: 'Maybe' },
  { ...available, accountId: reviewId },
  { ...available, watchedImport: { id: reviewId, state: 'Unknown' } },
  ...([
    { id: 'invalid', stage: 'Preview', canEnd: true, expiresAtUtc },
    { id: reviewId, stage: 'Processing', canEnd: true, expiresAtUtc: null },
    { id: reviewId, stage: 'Preview', canEnd: true, expiresAtUtc: 'invalid' },
    { id: reviewId, stage: 'Unknown', canEnd: false, expiresAtUtc },
  ]).map((activeImport) => ({ ...available, availability: 'Blocked', activeImport })),
])('rejects invalid availability instead of enabling a new import: %j', async (status) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(status)))
  await expect(getImportStatus(accountId)).rejects.toThrow('invalid response')
})

it.each([
  null,
  { id: accountId, state: 'Expired' },
  { id: reviewId, state: 'Ready', expiresAtUtc: 'not-a-date' },
  { id: reviewId, state: 'Ended', endedAtUtc: expiresAtUtc, endedBy: { userId: 'owner', userName: '  ' } },
])('rejects missing or invalid watched identity: %j', async (watchedImport) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...available, watchedImport })))
  await expect(getImportStatus(accountId, reviewId)).rejects.toThrow('invalid response')
})

it('preserves status errors and cancellation instead of reporting availability', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ title: 'Status failed' }, { status: 503 })))
  await expect(getImportStatus(accountId)).rejects.toMatchObject({ status: 503 })
  vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
    init?.signal?.throwIfAborted()
    throw new Error('Expected an aborted read')
  }))
  const controller = new AbortController()
  controller.abort(new DOMException('Timed out', 'TimeoutError'))
  await expect(getImportStatus(accountId, undefined, controller.signal)).rejects.toMatchObject({ name: 'TimeoutError' })
})

it('ends only the exact required review target', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    String(input) === '/api/security/csrf-token'
      ? Response.json({ requestToken: 'token' })
      : new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  await cancelActiveImportReview(accountId, reviewId)
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/accounts/${accountId}/active-import-review?reviewId=${reviewId}`,
    expect.objectContaining({ method: 'DELETE' }),
  )
})

it('refuses an invalid end target without an account-only request', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(cancelActiveImportReview(accountId, '')).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
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
