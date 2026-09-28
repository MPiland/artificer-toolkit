import { useQueryClient } from '@tanstack/react-query'
import { clearPrivateContentSnapshots } from '#app/data/contentSnapshots/privateContent'
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
        onSuccess={async () => {
          queryClient.clear()
          // Another account may have left private content snapshots in this browser.
          await clearPrivateContentSnapshots()
          window.location.assign(redirectTo ?? '/home')
        }}
      />
    </AuthPageShell>
  )
}
