import { AuthPageShell, ResetPasswordForm } from '../components'

export function ResetPasswordPage() {
  return (
    <AuthPageShell
      title='Reset your password'
      description="Enter your email and we'll send you a reset link."
    >
      <ResetPasswordForm />
    </AuthPageShell>
  )
}
