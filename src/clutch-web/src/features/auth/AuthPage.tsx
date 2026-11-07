import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/client'
import { register, signIn } from './api'

export function AuthPage() {
  const queryClient = useQueryClient()
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const authMutation = useMutation({
    mutationFn: async () => {
      if (isRegistering) {
        await register(email, password)
      }

      await signIn(email, password)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    authMutation.mutate()
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md items-center px-5 py-10">
      <section aria-labelledby="auth-heading" className="w-full space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <h1 id="auth-heading" className="text-2xl font-semibold">
            {isRegistering ? 'Create your account' : 'Sign in'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account and transaction data are private to you.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input
              id="email"
              autoComplete="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              maxLength={256}
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input
              id="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              aria-describedby={isRegistering ? 'password-requirements' : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              maxLength={256}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            {isRegistering && (
              <p id="password-requirements" className="text-sm text-muted-foreground">
                Use at least 12 characters, including an uppercase letter, a lowercase letter,
                a number, and a symbol.
              </p>
            )}
          </div>
          <button
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            disabled={authMutation.isPending}
            type="submit"
          >
            {authMutation.isPending
              ? 'Please wait…'
              : isRegistering
                ? 'Create account'
                : 'Sign in'}
          </button>
          {authMutation.isError && <p role="alert">{getErrorMessage(authMutation.error)}</p>}
        </form>
        <button
          className="text-sm underline underline-offset-4"
          onClick={() => {
            authMutation.reset()
            setIsRegistering(!isRegistering)
          }}
          type="button"
        >
          {isRegistering ? 'Already registered? Sign in' : 'New here? Create an account'}
        </button>
      </section>
    </main>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
