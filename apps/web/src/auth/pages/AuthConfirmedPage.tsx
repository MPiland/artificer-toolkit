import { Link } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { AuthPageShell } from '../components/AuthPageShell'
import { ctaRow, primaryLink, secondaryLink } from '#app/marketing/marketing.css'

export function AuthConfirmedPage({
  verificationFailed = false
}: {
  verificationFailed?: boolean
}) {
  return (
    <AuthPageShell
      title={
        verificationFailed ? 'This confirmation link is unavailable' : 'Your account is confirmed.'
      }
      description={
        verificationFailed
          ? 'The link may be invalid or expired. Sign in with your email or username and password to request a new confirmation link.'
          : 'Continue to sign in, then start creating.'
      }
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
