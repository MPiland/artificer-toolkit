import { AuthPageShell, SignUpForm } from '../components'

export function SignUpPage() {
  return (
    <AuthPageShell title='Create an account' description='Start building your world today'>
      <SignUpForm />
    </AuthPageShell>
  )
}
