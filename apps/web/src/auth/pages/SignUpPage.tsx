import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, SignUpForm } from '../components'

export function SignUpPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell title='Create an account' description='Start building your world today'>
      <SignUpForm
        onSuccess={(result) => result.session ? navigate({ to: '/home' }) : undefined}
      />
    </AuthPageShell>
  )
}
