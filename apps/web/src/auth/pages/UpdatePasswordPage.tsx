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

  return (
    <AuthPageShell
      title='Set a new password'
      description='Choose a new password, then return to your toolkit.'
    >
      <UpdatePasswordForm onSuccess={handleSuccess} />
    </AuthPageShell>
  )
}
