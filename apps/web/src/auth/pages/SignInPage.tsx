import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, SignInForm } from '../components'

export function SignInPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell title='Sign in' description='Welcome back to Artificer Toolkit'>
      <SignInForm onSuccess={() => navigate({ to: '/home' })} />
    </AuthPageShell>
  )
}
