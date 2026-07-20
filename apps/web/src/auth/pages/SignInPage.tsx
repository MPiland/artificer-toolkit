import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, SignInForm } from '../components'

export function SignInPage({ publicSignUpEnabled = false }: { publicSignUpEnabled?: boolean }) {
  const navigate = useNavigate()

  return (
    <AuthPageShell title='Sign in' description='Welcome back. Your table is waiting.'>
      <SignInForm
        publicSignUpEnabled={publicSignUpEnabled}
        onSuccess={() => navigate({ to: '/home' })}
      />
    </AuthPageShell>
  )
}
