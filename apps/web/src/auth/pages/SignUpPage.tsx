import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, SignUpForm } from '../components'

export function SignUpPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell
      title='Create your account'
      description='Start with a character or homebrew draft, then keep it ready for play.'
    >
      <SignUpForm
        onSuccess={(result) => result.session ? navigate({ to: '/home' }) : undefined}
      />
    </AuthPageShell>
  )
}
