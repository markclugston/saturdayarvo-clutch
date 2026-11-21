import type { QueryClient } from '@tanstack/react-query'
import { clearCsrfToken } from '@/lib/api/client'

/**
 * Returns to the sign-in screen after the session ended: drops every cached query except the session
 * (so no mortgage data survives for the next sign-in) and resets the session query, as App does.
 */
export async function returnToSignIn(queryClient: QueryClient): Promise<void> {
  clearCsrfToken()
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
  await queryClient.resetQueries({ queryKey: ['session'], exact: true })
}
