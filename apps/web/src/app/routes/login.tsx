import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthPageShell } from '#app/auth/AuthPageShell'
import { LoginForm } from '#app/auth/AuthForms'

export const Route = createFileRoute('/login')({
  component: LoginPage
})

function LoginPage() {
  const navigate = useNavigate()

  return (
    <AuthPageShell title='Sign in' description='Welcome back to Artificer Toolkit'>
      <LoginForm onSuccess={() => navigate({ to: '/home' })} />
    </AuthPageShell>
  )
}
