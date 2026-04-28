import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, UpdatePasswordForm } from '../components'

export function UpdatePasswordPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell
      title='Set a new password'
      description='Choose a new password, then return to your toolkit.'
      variant='support'
    >
      <UpdatePasswordForm onSuccess={() => navigate({ to: '/sign-in' })} />
    </AuthPageShell>
  )
}
