import { afterEach, expect, it, vi } from 'vitest'
import { createFamily } from '@/features/families/api'
import { clearCsrfToken } from '@/lib/api/client'
import { register, signIn, signOut } from './api'

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
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
      if (path === '/api/families') {
        expect(token).toBe('authenticated-token')
        return Response.json({
          id: '550e8400-e29b-41d4-a716-446655440000',
          ownerUserId: 'user-id',
        }, { status: 201 })
      }
      throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    if (withRegistration) {
      await register('user@example.test', 'Example-password-123!')
    }
    await signIn('user@example.test', 'Example-password-123!')
    await createFamily()

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
