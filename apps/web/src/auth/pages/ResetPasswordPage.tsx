import { AuthPageShell, ResetPasswordForm } from '../components'

export function ResetPasswordPage() {
  return (
    <AuthPageShell
      title='Reset your password'
      description='Enter the email address for your account.'
    >
      <ResetPasswordForm />
    </AuthPageShell>
  )
}
