import { createFileRoute } from '@tanstack/react-router'
import { AuthPageShell } from '#app/auth/AuthPageShell'
import { transitionContent } from '#app/auth/auth.css'
import { ctaRow, primaryLink, secondaryLink } from '#app/public/public.css'

export const Route = createFileRoute('/auth/confirmed')({
  component: AuthConfirmedPage
})

function AuthConfirmedPage() {
  return (
    <AuthPageShell
      title='Your confirmation link has been accepted.'
      description='Continue into the login flow or return to the public homepage.'
    >
      <div className={transitionContent}>
        <div className={ctaRow}>
          <a className={primaryLink} href='/login'>
            Continue to login
          </a>
          <a className={secondaryLink} href='/'>
            Back to homepage
          </a>
        </div>
      </div>
    </AuthPageShell>
  )
}
