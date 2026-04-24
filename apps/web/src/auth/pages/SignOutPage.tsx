import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { browserAuthClient } from '../authClient'
import { AuthPageShell } from '../components'

export function SignOutPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function signOut() {
      await browserAuthClient.signOut()
      if (!cancelled) {
        await navigate({ to: '/sign-in' })
      }
    }

    void signOut()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <AuthPageShell title='Closing the current session.' description='Returning you to sign in.'>
      <div className={transitionContent}>
        <p>Signing you out and returning to sign in...</p>
      </div>
    </AuthPageShell>
  )
}
