import { createFileRoute, redirect } from '@tanstack/react-router'
import { ResetPassword } from '../domains/auth/ResetPassword'
import { resetPasswordFn } from '@server/auth'
import { useServerFn } from '@tanstack/react-start'
import { notifications } from '@mantine/notifications'
import { getSupabaseServerClient } from '@utils'
import { useMutation } from '@hooks'

export const Route = createFileRoute('/reset-password')({
  beforeLoad: async () => {
    const supabase = getSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw redirect({ href: '/login' })
  },
  component: ResetPasswordComp,
})

function ResetPasswordComp() {
  const resetPassword = useMutation({
    fn: useServerFn(resetPasswordFn),
  })

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const password = fd.get('password') as string

    const res = await resetPassword.mutate({ data: { password } })

    if (res?.error) {
      notifications.show({
        message: 'Something went wrong resetting password.',
        color: 'red',
        position: 'top-center',
        autoClose: 2500,
      })
      return
    }

    notifications.show({
      message: 'Password reset successfully!',
      color: 'green',
      position: 'top-center',
      autoClose: 2500,
    })

    throw redirect({ href: '/' })
  }

  const uiStatus: 'pending' | 'idle' | 'success' | 'error' =
    resetPassword.status === 'pending' ? 'pending'
    : resetPassword.status === 'error' ? 'error'
    : resetPassword.status === 'success' ? 'success'
    : 'idle'

  return <ResetPassword onSubmit={handleSubmit} status={uiStatus} />
}
