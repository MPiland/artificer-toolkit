import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthPageShell } from '#app/auth/AuthPageShell'
import { transitionContent } from '#app/auth/auth.css'
import { browserAuthClient } from '#app/auth/authClient'

export const Route = createFileRoute('/logout')({
  component: LogoutPage
})

function LogoutPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function signOut() {
      await browserAuthClient.signOut()
      if (!cancelled) {
        await navigate({ to: '/login' })
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
        <p>Signing you out and returning to login...</p>
      </div>
    </AuthPageShell>
  )
}
