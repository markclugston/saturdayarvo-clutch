import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, clearCsrfToken } from '@/lib/api/client'
import { getThemePreference, saveThemePreference } from './api'

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
})

describe('theme preference API', () => {
  it.each(['Light', 'Dark', 'System'] as const)('accepts the canonical %s mode', async (mode) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ mode })))

    await expect(getThemePreference()).resolves.toEqual({ mode })
  })

  it('rejects unsupported response modes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ mode: 'dark' })))

    await expect(getThemePreference()).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      message: 'The server returned an invalid response.',
    })
  })

  it('sends an authenticated-mode update with the shared antiforgery token', async () => {
    const requests: { path: string; init?: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      requests.push({ path, init })
      if (path === '/api/security/csrf-token') {
        return Response.json({ requestToken: 'csrf-token' })
      }

      return Response.json({ mode: 'Dark' })
    }))

    await expect(saveThemePreference('Dark')).resolves.toEqual({ mode: 'Dark' })

    expect(requests.map(({ path }) => path)).toEqual([
      '/api/security/csrf-token',
      '/api/preferences/theme',
    ])
    const updateRequest = requests[1]
    expect(updateRequest).toBeDefined()
    if (!updateRequest) {
      throw new Error('The theme preference update request was not sent.')
    }

    expect(updateRequest.init?.method).toBe('PUT')
    expect(JSON.parse(String(updateRequest.init?.body))).toEqual({ mode: 'Dark' })
    expect(new Headers(updateRequest.init?.headers).get('X-CSRF-TOKEN')).toBe('csrf-token')
  })

  it('preserves save failures as typed API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      status: 503,
      title: 'Preference service unavailable.',
    }, { status: 503, headers: { 'Content-Type': 'application/problem+json' } })))

    const failingSave = saveThemePreference('System')
    await expect(failingSave).rejects.toBeInstanceOf(ApiError)
    await expect(failingSave).rejects.toMatchObject({
      status: 503,
      problem: { title: 'Preference service unavailable.' },
    })
  })
})
