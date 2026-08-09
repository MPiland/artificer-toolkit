import { useNavigate } from '@tanstack/react-router'
import { AuthPageShell, SignInForm } from '../components'

export function SignInPage({
  publicSignUpEnabled = false,
  redirectTo
}: {
  publicSignUpEnabled?: boolean
  redirectTo?: string
}) {
  const navigate = useNavigate()

  return (
    <AuthPageShell title='Sign in' description='Welcome back. Your table is waiting.'>
      <SignInForm
        publicSignUpEnabled={publicSignUpEnabled}
        onSuccess={() => {
          if (redirectTo) {
            window.location.assign(redirectTo)
            return
          }
          return navigate({ to: '/home' })
        }}
      />
    </AuthPageShell>
  )
}
