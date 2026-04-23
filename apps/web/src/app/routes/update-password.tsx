import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { AuthPageShell } from '#app/auth/AuthPageShell'
import { UpdatePasswordForm } from '#app/auth/AuthForms'

export const Route = createFileRoute('/update-password')({
  component: UpdatePasswordPage
})

function UpdatePasswordPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell
      title='Set a new password'
      description='Choose a new password to finish recovering your account.'
    >
      <UpdatePasswordForm onSuccess={() => navigate({ to: '/login' })} />
    </AuthPageShell>
  )
}
