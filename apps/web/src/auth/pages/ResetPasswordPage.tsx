import { AuthPageShell, ResetPasswordForm } from '../components'

export function ResetPasswordPage() {
  return (
    <AuthPageShell
      title='Reset your password'
      description="Enter your email and we'll send a secure reset link if email delivery is available."
      variant='support'
    >
      <ResetPasswordForm />
    </AuthPageShell>
  )
}
