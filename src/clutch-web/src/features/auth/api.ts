import { z } from 'zod'
import { apiRequest, clearCsrfToken } from '@/lib/api/client'
import { SessionSchema, type UserSession } from '@/lib/api/schemas'

const EmptyResponseSchema = z.undefined()

export function getSession(signal?: AbortSignal): Promise<UserSession> {
  const timeoutSignal = AbortSignal.timeout(8000)
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal

  return apiRequest('/api/security/session', SessionSchema, { signal: requestSignal })
}

export function register(email: string, password: string): Promise<UserSession> {
  return apiRequest('/api/security/register', SessionSchema, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function signIn(email: string, password: string): Promise<void> {
  await apiRequest('/api/security/login', EmptyResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  clearCsrfToken()
}

export async function signOut(): Promise<void> {
  await apiRequest('/api/security/logout', EmptyResponseSchema, {
    method: 'POST',
  })
  clearCsrfToken()
}
