import { useNavigate, useRouter } from '@tanstack/react-router'
import { AuthPageShell, UpdatePasswordForm } from '../components'

export function UpdatePasswordPage({ invitation = false }: { invitation?: boolean }) {
  const navigate = useNavigate()
  const router = useRouter()

  async function handleSuccess() {
    if (invitation) {
      await router.invalidate()
      await navigate({ to: '/home' })
      return
    }

    await navigate({ to: '/sign-in' })
  }

  async function handleBackToSignIn() {
    await router.invalidate()
    await navigate({ to: '/sign-in', replace: true })
  }

  return (
    <AuthPageShell
      title={invitation ? 'Complete your account' : 'Set a new password'}
      description={
        invitation
          ? 'Choose a username and password to finish setting up your account.'
          : 'Choose a new password for your account.'
      }
    >
      <UpdatePasswordForm
        invitation={invitation}
        onBackToSignIn={handleBackToSignIn}
        onSuccess={handleSuccess}
      />
    </AuthPageShell>
  )
}
