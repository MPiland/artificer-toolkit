import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { browserAuthClient } from '../authClient'
import { AuthPageShell } from '../components/AuthPageShell'

export function SignOutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function signOut() {
      const result = await browserAuthClient.signOut()
      if (!result.ok) return

      queryClient.clear()
      if (cancelled) return

      await router.invalidate()
      await navigate({ to: '/sign-in' })
    }

    void signOut()

    return () => {
      cancelled = true
    }
  }, [navigate, queryClient, router])

  return (
    <AuthPageShell title='Closing this session.' description='Returning you to sign in.'>
      <div className={transitionContent}>
        <p>Signing you out and returning to sign in...</p>
      </div>
    </AuthPageShell>
  )
}
