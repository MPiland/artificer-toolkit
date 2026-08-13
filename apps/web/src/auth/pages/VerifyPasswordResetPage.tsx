import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, VerifyPasswordResetForm } from '../components'

export function VerifyPasswordResetPage({ initialEmail }: { initialEmail?: string }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!initialEmail || typeof window === 'undefined') return

    const url = new URL(window.location.href)
    if (!url.searchParams.has('email')) return

    url.searchParams.delete('email')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [initialEmail])

  async function handleSuccess() {
    await navigate({ to: '/update-password', replace: true })
  }

  return (
    <AuthPageShell
      title='Verify your reset code'
      description='Confirm the code from your email before choosing a new password.'
    >
      <VerifyPasswordResetForm initialEmail={initialEmail} onSuccess={handleSuccess} />
    </AuthPageShell>
  )
}
