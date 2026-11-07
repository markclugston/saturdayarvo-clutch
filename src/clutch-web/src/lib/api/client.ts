import type { z } from 'zod'
import {
  CsrfTokenSchema,
  ProblemDetailsSchema,
  type ProblemDetails,
} from './schemas'

export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails
  readonly location: string | null

  constructor(
    status: number,
    problem: ProblemDetails,
    location: string | null = null,
  ) {
    super(problem.detail ?? problem.title ?? 'The request could not be completed.')
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.location = location
  }
}

let csrfToken: string | null = null

export function clearCsrfToken(): void {
  csrfToken = null
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const requiresCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const headers = new Headers(init.headers)

  if (requiresCsrf) {
    headers.set('X-CSRF-TOKEN', await getCsrfToken())
  }

  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    if (requiresCsrf && response.status === 400) {
      clearCsrfToken()
    }

    throw await createApiError(response)
  }

  if (response.status === 204) {
    const parsedEmpty = schema.safeParse(undefined)
    if (parsedEmpty.success) {
      return parsedEmpty.data
    }

    throw new ApiError(response.status, {
      title: 'The server returned an unexpected empty response.',
      status: response.status,
    }, response.headers.get('Location'))
  }

  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    throw new ApiError(response.status, {
      title: 'The server returned an invalid response.',
      status: response.status,
    }, response.headers.get('Location'))
  }

  const parsed = schema.safeParse(responseBody)
  if (!parsed.success) {
    throw new ApiError(response.status, {
      title: 'The server returned an invalid response.',
      status: response.status,
    }, response.headers.get('Location'))
  }

  return parsed.data
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken !== null) {
    return csrfToken
  }

  const response = await fetch('/api/security/csrf-token', {
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await createApiError(response)
  }

  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    throw new ApiError(response.status, {
      title: 'The server returned an invalid anti-forgery response.',
      status: response.status,
    })
  }

  const parsed = CsrfTokenSchema.safeParse(responseBody)
  if (!parsed.success) {
    throw new ApiError(response.status, {
      title: 'The server returned an invalid anti-forgery response.',
      status: response.status,
    })
  }

  csrfToken = parsed.data.requestToken
  return csrfToken
}

async function createApiError(response: Response): Promise<ApiError> {
  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    return new ApiError(response.status, {
      title: 'The request could not be completed.',
      status: response.status,
    })
  }

  const parsed = ProblemDetailsSchema.safeParse(responseBody)
  if (!parsed.success) {
    return new ApiError(response.status, {
      title: 'The request could not be completed.',
      status: response.status,
    })
  }

  return new ApiError(response.status, parsed.data)
}
