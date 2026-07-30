import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { accountProfileQueryKey } from '#app/settings/accountQueries'
import { AuthPageShell, UpdatePasswordForm } from '../components'

export function UpdatePasswordPage({ invitation = false }: { invitation?: boolean }) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  async function handleSuccess() {
    if (invitation) {
      await queryClient.invalidateQueries({ queryKey: accountProfileQueryKey })
      await router.invalidate()
      await navigate({ to: '/home' })
      return
    }

    await navigate({ to: '/sign-in' })
  }

  return (
    <AuthPageShell
      title={invitation ? 'Complete your account' : 'Set a new password'}
      description={
        invitation
          ? 'Choose your username and password to enter the Forge.'
          : 'Choose a new password, then return to your toolkit.'
      }
    >
      <UpdatePasswordForm invitation={invitation} onSuccess={handleSuccess} />
    </AuthPageShell>
  )
}
