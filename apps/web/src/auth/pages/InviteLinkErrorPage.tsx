import { Link } from '@tanstack/react-router'
import { transitionContent } from '../auth.css'
import { AuthPageShell } from '../components/AuthPageShell'
import { ctaRow, primaryLink } from '#app/marketing/marketing.css'

export function InviteLinkErrorPage() {
  return (
    <AuthPageShell
      title='This invitation link is unavailable'
      description='It may have expired or already been used. Ask the person who invited you to send a new invitation.'
    >
      <div className={transitionContent}>
        <div className={ctaRow}>
          <Link className={primaryLink} to='/sign-in'>
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthPageShell>
  )
}
