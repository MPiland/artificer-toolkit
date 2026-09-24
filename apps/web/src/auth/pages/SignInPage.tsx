import { useQueryClient } from '@tanstack/react-query'
import { AuthPageShell } from '../components/AuthPageShell'
import { SignInForm } from '../components/SignInForm'

export function SignInPage({
  publicSignUpEnabled = false,
  redirectTo
}: {
  publicSignUpEnabled?: boolean
  redirectTo?: string
}) {
  const queryClient = useQueryClient()

  return (
    <AuthPageShell title='Sign in' description='Sign in to continue.'>
      <SignInForm
        publicSignUpEnabled={publicSignUpEnabled}
        onSuccess={() => {
          queryClient.clear()
          window.location.assign(redirectTo ?? '/home')
        }}
      />
    </AuthPageShell>
  )
}
