import { createFileRoute } from '@tanstack/react-router'
import { AuthPageShell } from '#app/auth/AuthPageShell'
import { ResetPasswordForm } from '#app/auth/AuthForms'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage
})

function ResetPasswordPage() {
  return (
    <AuthPageShell
      title='Reset your password'
      description="Enter your email and we'll send you a reset link."
    >
      <ResetPasswordForm />
    </AuthPageShell>
  )
}
