import { Link, useNavigate } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { AuthPageShell, SignUpForm } from '../components'
import { ctaRow, primaryLink } from '#app/marketing/marketing.css'

export function SignUpPage({ publicSignUpEnabled = false }: { publicSignUpEnabled?: boolean }) {
  const navigate = useNavigate()

  if (!publicSignUpEnabled) {
    return (
      <AuthPageShell
        title='Access is currently invite-only'
        description='This application is currently in closed testing. If you received an invitation, use the link in that email to finish setting up your account.'
      >
        <div className={transitionContent}>
          <div className={ctaRow}>
            <Link className={primaryLink} to='/sign-in'>
              Already have an account? Sign in.
            </Link>
          </div>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title='Create your account'
      description='Create an account to save your characters and homebrew.'
    >
      <SignUpForm
        onSuccess={(result) => (result.session ? navigate({ to: '/home' }) : undefined)}
      />
    </AuthPageShell>
  )
}
