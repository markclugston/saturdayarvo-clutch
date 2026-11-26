import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContentPanel } from '@/components/ui/content-panel'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { ApiError } from '@/lib/api/client'
import { register, signIn } from './api'

export function AuthPage({ inert = false }: { inert?: boolean }) {
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
    <div className="flex min-h-svh bg-canvas">
      <ContentPanel inert={inert}>
        {/* Auto margins centre the card in the panel's full-height column and never push its top off a short screen. */}
        <Card
          aria-labelledby="auth-heading"
          as="section"
          className="m-auto w-full max-w-md space-y-6 p-6"
        >
          <div>
            <h1
              className="text-2xl font-semibold"
              id="auth-heading"
            >
              {isRegistering ? 'Create Your Account' : 'Sign In'}
            </h1>
            <p className="mt-2 text-sm text-fg-secondary">
              Your account and transaction data are private to you.
            </p>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            <FloatingField
              autoComplete="email"
              id="email"
              label="Email"
              maxLength={256}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
            <FloatingField
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              description={isRegistering
                ? {
                  id: 'password-requirements',
                  text: 'Use at least 12 characters, including an uppercase letter, a lowercase letter, a number, and a symbol.',
                }
                : undefined}
              id="password"
              label="Password"
              maxLength={256}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
            <Button
              className="w-full"
              disabled={authMutation.isPending}
              type="submit"
            >
              {authMutation.isPending
                ? 'Please wait…'
                : isRegistering
                  ? 'Create Account'
                  : 'Sign In'}
            </Button>
            {authMutation.isError && <ErrorMessage>{getErrorMessage(authMutation.error)}</ErrorMessage>}
          </form>
          <Button
            onClick={() => {
              authMutation.reset()
              setIsRegistering(!isRegistering)
            }}
            type="button"
            variant="tertiary"
          >
            {isRegistering ? 'Already Registered? Sign In' : 'New Here? Create an Account'}
          </Button>
        </Card>
      </ContentPanel>
    </div>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
