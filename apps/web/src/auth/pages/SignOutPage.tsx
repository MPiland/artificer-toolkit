import { Button } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { authButton, authFormMessage, authFormMessageError, transitionContent } from '../auth.css'
import { browserAuthClient, type AuthResult } from '../authClient'
import { AuthPageShell } from '../components/AuthPageShell'

export function SignOutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<AuthResult>()

  useEffect(() => {
    let cancelled = false

    async function signOut() {
      const result = await browserAuthClient.signOut()
      if (cancelled) return
      if (!result.ok) {
        setFailure(result)
        return
      }

      queryClient.clear()
      await router.invalidate()
      await navigate({ to: '/sign-in' })
    }

    void signOut()

    return () => {
      cancelled = true
    }
  }, [attempt, navigate, queryClient, router])

  return (
    <AuthPageShell title='Closing this session.' description='Returning you to sign in.'>
      <div className={transitionContent}>
        {failure ? (
          <>
            <p className={`${authFormMessage} ${authFormMessageError}`} role='alert'>
              {failure.message}
            </p>
            <Button
              className={authButton}
              onClick={() => {
                setFailure(undefined)
                setAttempt((current) => current + 1)
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <p>Signing you out and returning to sign in...</p>
        )}
      </div>
    </AuthPageShell>
  )
}
