import { Link } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { AuthPageShell } from '../components'
import { ctaRow, primaryLink, secondaryLink } from '#app/marketing/marketing.css'

export function AuthConfirmedPage() {
  return (
    <AuthPageShell
      title='Your account is confirmed.'
      description='Continue to sign in, then start creating.'
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
