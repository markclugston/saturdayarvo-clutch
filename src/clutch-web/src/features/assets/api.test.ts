import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '@/lib/api/client'
import {
  acquireEdit,
  assetErrorCode,
  assetFieldErrors,
  blockedEditStatus,
  createAsset,
  deleteAsset,
  endOtherEdit,
  getEditStatus,
  isAssetGone,
  listAssets,
  releaseEdit,
  saveAsset,
} from './api'

const assetId = '550e8400-e29b-41d4-a716-446655440000'
const editId = '550e8400-e29b-41d4-a716-446655440002'
const detail = {
  id: assetId,
  name: 'House',
  description: null,
  currencyCode: 'AUD',
  valuations: [{ id: editId, value: 100, valuationDate: '2026-01-01' }],
}
const input = {
  name: 'House',
  description: null,
  currencyCode: 'AUD',
  valuations: [{ value: 100, valuationDate: '2026-01-01' }],
}
const expiresAtUtc = '2026-11-27T12:05:00+00:00'

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
})

/** Answers the CSRF request, then every other request with `respond`. */
function stubFetch(respond: () => Response) {
  const fetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async (path) =>
    path === '/api/security/csrf-token' ? Response.json({ requestToken: 'token' }) : respond())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sent(fetchMock: ReturnType<typeof stubFetch>) {
  const [path, init] = fetchMock.mock.calls.at(-1)!
  return { path, init: init!, csrf: new Headers(init!.headers).get('X-CSRF-TOKEN') }
}

const problem = (status: number, extra: object = {}) =>
  () => Response.json({ title: 'Problem', status, ...extra }, { status })
const coded = (status: number, code: string, extra: object = {}) =>
  problem(status, { errors: { code: [code] }, ...extra })

describe('asset clients', () => {
  it('lists assets with their totals', async () => {
    const list = { assets: [], totals: [] }
    const fetchMock = stubFetch(() => Response.json(list))

    await expect(listAssets()).resolves.toEqual(list)
    expect(sent(fetchMock).path).toBe('/api/assets')
  })

  it('creates an asset with the antiforgery token', async () => {
    const fetchMock = stubFetch(() => Response.json(detail, { status: 201 }))

    await expect(createAsset(input)).resolves.toEqual(detail)
    const request = sent(fetchMock)
    expect(request).toMatchObject({ path: '/api/assets', csrf: 'token' })
    expect(request.init.method).toBe('POST')
    expect(JSON.parse(String(request.init.body))).toEqual(input)
  })

  it('reads the first message of each server field error', async () => {
    stubFetch(problem(400, { errors: { name: ['Enter a name'], 'valuations[0].value': ['Enter a value'] } }))

    const error = await createAsset(input).catch((caught: unknown) => caught)

    expect(assetFieldErrors(error)).toEqual({
      name: 'Enter a name', 'valuations[0].value': 'Enter a value',
    })
  })

  it('has no field errors for other failures', () => {
    expect(assetFieldErrors(new TypeError('offline'))).toBeNull()
  })

  it('opens an edit', async () => {
    const lease = { editId, expiresAtUtc, serverTimeUtc: expiresAtUtc, asset: detail }
    const fetchMock = stubFetch(() => Response.json(lease, { status: 201 }))

    await expect(acquireEdit(assetId)).resolves.toEqual(lease)
    expect(sent(fetchMock)).toMatchObject({ path: `/api/assets/${assetId}/edits`, csrf: 'token' })
  })

  it('reads the blocking edit from a refused open', async () => {
    const editStatus = {
      assetId, availability: 'Blocked', activeEdit: { id: editId, expiresAtUtc }, watchedEdit: null,
    }
    stubFetch(coded(409, 'AssetEditActive', { editStatus }))

    const error = await acquireEdit(assetId).catch((caught: unknown) => caught)

    expect(assetErrorCode(error)).toBe('AssetEditActive')
    expect(blockedEditStatus(error)).toEqual(editStatus)
  })

  it('reads a missing asset', async () => {
    stubFetch(coded(404, 'AssetNotFound'))

    const error = await acquireEdit(assetId).catch((caught: unknown) => caught)

    expect(isAssetGone(error)).toBe(true)
    expect(blockedEditStatus(error)).toBeNull()
  })

  it('asks for status without caching and validates the asset and edit it answers about', async () => {
    const status = {
      assetId, availability: 'Available', activeEdit: null, watchedEdit: { id: editId, state: 'Released' },
    }
    const controller = new AbortController()
    const fetchMock = stubFetch(() => Response.json(status))

    await expect(getEditStatus(assetId, editId, controller.signal)).resolves.toEqual(status)

    expect(sent(fetchMock).path).toBe(`/api/assets/${assetId}/edit-status?editId=${editId}`)
    expect(sent(fetchMock).init).toMatchObject({ cache: 'no-store', signal: controller.signal })
    // An answer about a different edit is not an answer.
    await expect(getEditStatus(assetId, assetId)).rejects.toMatchObject({ status: 200 })
    await expect(getEditStatus(assetId)).rejects.toMatchObject({ status: 200 })
  })

  it('saves with the edit id', async () => {
    const fetchMock = stubFetch(() => Response.json(detail))

    await saveAsset(assetId, editId, input)

    const request = sent(fetchMock)
    expect(request).toMatchObject({ path: `/api/assets/${assetId}`, csrf: 'token' })
    expect(request.init.method).toBe('PUT')
    expect(JSON.parse(String(request.init.body))).toEqual({ ...input, editId })
  })

  it.each(['AssetEditEnded', 'AssetEditExpired', 'AssetEditChanged'])(
    'reads the %s refusal of a save',
    async (code) => {
      stubFetch(coded(409, code))

      const error = await saveAsset(assetId, editId, input).catch((caught: unknown) => caught)

      expect(assetErrorCode(error)).toBe(code)
    },
  )

  it('releases an edit, surviving page unload only when asked', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))

    await releaseEdit(assetId, editId)
    expect(sent(fetchMock)).toMatchObject({
      path: `/api/assets/${assetId}/edits/${editId}`, csrf: 'token',
    })
    expect(sent(fetchMock).init.keepalive).toBeFalsy()

    await releaseEdit(assetId, editId, { keepalive: true })
    expect(sent(fetchMock).init).toMatchObject({ method: 'DELETE', keepalive: true })
  })

  it('ends exactly the targeted edit', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))

    await endOtherEdit(assetId, editId)

    expect(sent(fetchMock)).toMatchObject({
      path: `/api/assets/${assetId}/active-edit?editId=${editId}`, csrf: 'token',
    })
    expect(sent(fetchMock).init.method).toBe('DELETE')
  })

  it('deletes an asset', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))

    await expect(deleteAsset(assetId)).resolves.toBeUndefined()

    expect(sent(fetchMock)).toMatchObject({ path: `/api/assets/${assetId}`, csrf: 'token' })
    expect(sent(fetchMock).init.method).toBe('DELETE')
  })

  it.each([[409, 'AssetEditActive'], [404, 'AssetNotFound']])(
    'reads a %i refusal of a delete',
    async (status, code) => {
      stubFetch(coded(status, code))

      const error = await deleteAsset(assetId).catch((caught: unknown) => caught)

      expect(assetErrorCode(error)).toBe(code)
      expect(isAssetGone(error)).toBe(status === 404)
    },
  )
})
