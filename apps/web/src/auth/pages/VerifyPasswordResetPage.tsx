import { useNavigate, useRouter } from '@tanstack/react-router'
import { AuthPageShell, VerifyPasswordResetForm } from '../components'

export function VerifyPasswordResetPage() {
  const navigate = useNavigate()
  const router = useRouter()

  async function handleSuccess() {
    await navigate({ to: '/update-password', replace: true })
    await router.invalidate()
  }

  return (
    <AuthPageShell
      title='Verify your reset code'
      description='Confirm the code from your email before choosing a new password.'
    >
      <VerifyPasswordResetForm onSuccess={handleSuccess} />
    </AuthPageShell>
  )
}
