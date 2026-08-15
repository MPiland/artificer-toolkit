import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, ResetPasswordForm } from '../components'

export function ResetPasswordPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell
      title='Reset your password'
      description='Enter the email address for your account.'
    >
      <ResetPasswordForm
        onCodeSent={(email) =>
          navigate({ to: '/verify-password-reset', search: { email }, replace: true })
        }
      />
    </AuthPageShell>
  )
}
