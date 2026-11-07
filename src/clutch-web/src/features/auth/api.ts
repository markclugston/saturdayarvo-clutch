import { z } from 'zod'
import { apiRequest, clearCsrfToken } from '@/lib/api/client'
import { SessionSchema, type UserSession } from '@/lib/api/schemas'

const EmptyResponseSchema = z.undefined()

export function getSession(): Promise<UserSession> {
  return apiRequest('/api/security/session', SessionSchema)
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
