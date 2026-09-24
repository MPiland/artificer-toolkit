import { useEffect, useRef, useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  authInvitationRedeemInputSchema,
  type AuthInvitationRedeemInput
} from '@artificer-toolkit/schema/api/auth'
import { z } from 'zod/mini'
import { AuthPageShell } from '../components/AuthPageShell'
import { UpdatePasswordForm } from '../components/UpdatePasswordForm'
import { InviteLinkErrorPage } from './InviteLinkErrorPage'

type InvitationCredentials = Pick<AuthInvitationRedeemInput, 'email' | 'token'>

const invitationCredentialsSchema = z.pick(authInvitationRedeemInputSchema, {
  email: true,
  token: true
})

export function UpdatePasswordPage({ invitation = false }: { invitation?: boolean }) {
  const navigate = useNavigate()
  const router = useRouter()
  const [invitationCredentials, setInvitationCredentials] = useState<InvitationCredentials | null>()
  const fragmentRead = useRef(false)

  useEffect(() => {
    if (!invitation || fragmentRead.current) return
    fragmentRead.current = true

    const url = new URL(window.location.href)
    const fragment = new URLSearchParams(url.hash.slice(1))
    const parsed = invitationCredentialsSchema.safeParse({
      email: fragment.get('email'),
      token: fragment.get('token')
    })

    url.hash = ''
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    setInvitationCredentials(parsed.success ? parsed.data : null)
  }, [invitation])

  async function handleSuccess() {
    await navigate({ to: '/sign-in' })
  }

  async function handleBackToSignIn() {
    await router.invalidate()
    await navigate({ to: '/sign-in', replace: true })
  }

  if (invitation && invitationCredentials === null) return <InviteLinkErrorPage />

  return (
    <AuthPageShell
      title={invitation ? 'Complete your account' : 'Set a new password'}
      description={
        invitation
          ? 'Choose a username and password to finish setting up your account.'
          : 'Choose a new password for your account.'
      }
    >
      <UpdatePasswordForm
        invitation={invitation}
        invitationCredentials={invitationCredentials ?? undefined}
        onBackToSignIn={handleBackToSignIn}
        onSuccess={handleSuccess}
      />
    </AuthPageShell>
  )
}
