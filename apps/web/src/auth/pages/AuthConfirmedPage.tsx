import { Link } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { AuthPageShell } from '../components'
import { ctaRow, primaryLink, secondaryLink } from '#app/marketing/marketing.css'

export function AuthConfirmedPage() {
  return (
    <AuthPageShell
      title='Your confirmation link has been accepted.'
      description='Continue into the login flow or return to the public homepage.'
    >
      <div className={transitionContent}>
        <div className={ctaRow}>
          <Link className={primaryLink} to='/sign-in'>
            Continue to sign in
          </Link>
          <Link className={secondaryLink} to='/'>
            Back to homepage
          </Link>
        </div>
      </div>
    </AuthPageShell>
  )
}
