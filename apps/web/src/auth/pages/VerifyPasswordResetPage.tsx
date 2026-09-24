import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { AuthPasswordResetInput } from '@artificer-toolkit/schema/api/auth'
import { AuthPageShell } from '../components/AuthPageShell'
import { UpdatePasswordForm } from '../components/UpdatePasswordForm'
import { VerifyPasswordResetForm } from '../components/VerifyPasswordResetForm'

export function VerifyPasswordResetPage({ initialEmail }: { initialEmail?: string }) {
  const navigate = useNavigate()
  const [recovery, setRecovery] = useState<Pick<AuthPasswordResetInput, 'email' | 'token'> | null>(
    null
  )

  useEffect(() => {
    if (!initialEmail || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    if (!url.searchParams.has('email')) return

    url.searchParams.delete('email')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [initialEmail])

  async function handleSuccess() {
    setRecovery(null)
    await navigate({ to: '/sign-in', replace: true })
  }

  return (
    <AuthPageShell
      title='Verify your reset code'
      description='Confirm the code from your email before choosing a new password.'
    >
      {recovery ? (
        <UpdatePasswordForm recovery={recovery} onSuccess={handleSuccess} />
      ) : (
        <VerifyPasswordResetForm initialEmail={initialEmail} onVerified={setRecovery} />
      )}
    </AuthPageShell>
  )
}
