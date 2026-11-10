import { afterEach, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '@/lib/api/client'
import { getSession, register, signIn, signOut } from './api'

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('forwards query cancellation to the session request', async () => {
  const controller = new AbortController()
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const request = getSession(controller.signal)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/security/session',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  controller.abort()

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
})

it('uses an eight-second timeout for the session request', async () => {
  const timeoutSignal = AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal)
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    Promise.reject(init?.signal?.reason),
  )
  vi.stubGlobal('fetch', fetchMock)

  await expect(getSession()).rejects.toMatchObject({ name: 'TimeoutError' })

  expect(timeout).toHaveBeenCalledWith(8000)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/security/session',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})

it.each([false, true])(
  'refreshes the anti-forgery token after sign-in (registration: %s)',
  async (withRegistration) => {
    let authenticated = false
    const tokenRequests: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === '/api/security/csrf-token') {
        const token = authenticated ? 'authenticated-token' : 'anonymous-token'
        tokenRequests.push(token)
        return Response.json({ requestToken: token })
      }

      const token = new Headers(init?.headers).get('X-CSRF-TOKEN')
      if (path === '/api/security/register') {
        expect(token).toBe('anonymous-token')
        return Response.json({ id: 'user-id' }, { status: 201 })
      }
      if (path === '/api/security/login') {
        expect(token).toBe('anonymous-token')
        authenticated = true
        return new Response(null, { status: 204 })
      }
      if (path === '/api/security/logout') {
        expect(token).toBe('authenticated-token')
        authenticated = false
        return new Response(null, { status: 204 })
      }
      throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    if (withRegistration) {
      await register('user@example.test', 'Example-password-123!')
    }
    await signIn('user@example.test', 'Example-password-123!')
    await signOut()

    expect(tokenRequests).toEqual(['anonymous-token', 'authenticated-token'])
  },
)

it('refreshes the anti-forgery token after signing out', async () => {
  let authenticated = true
  const tokenRequests: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/security/csrf-token') {
      const token = authenticated ? 'authenticated-token' : 'anonymous-token'
      tokenRequests.push(token)
      return Response.json({ requestToken: token })
    }
    if (path === '/api/security/logout') {
      expect(new Headers(init?.headers).get('X-CSRF-TOKEN')).toBe('authenticated-token')
      authenticated = false
      return new Response(null, { status: 204 })
    }
    if (path === '/api/security/login') {
      expect(new Headers(init?.headers).get('X-CSRF-TOKEN')).toBe('anonymous-token')
      return new Response(null, { status: 204 })
    }
    throw new Error(`Unexpected request: ${path}`)
  }))

  await signOut()
  await signIn('user@example.test', 'Example-password-123!')
  expect(tokenRequests).toEqual(['authenticated-token', 'anonymous-token'])
})
