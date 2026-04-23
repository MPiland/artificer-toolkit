import { createFileRoute } from '@tanstack/react-router'
import { AuthPageShell } from '#app/auth/AuthPageShell'
import { SignupForm } from '#app/auth/AuthForms'

export const Route = createFileRoute('/signup')({
  component: SignupPage
})

function SignupPage() {
  return (
    <AuthPageShell title='Create an account' description='Start building your world today'>
      <SignupForm />
    </AuthPageShell>
  )
}
