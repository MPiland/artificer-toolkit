import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { Auth } from '#auth'
import { getSupabaseBrowserClient } from '#supabase'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  // Supabase embeds the recovery token in the URL hash on redirect.
  // By the time this page mounts, getSupabaseBrowserClient() has already
  // exchanged the hash for a session via onAuthStateChange.
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [hint, setHint] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const password = fd.get('password') as string

    setStatus('pending')
    setHint(null)

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setHint(error.message)
      return
    }

    notifications.show({
      message: 'Password updated successfully.',
      color: 'teal',
      autoClose: 2500,
    })

    await router.navigate({ to: '/login' })
  }

  return (
    <Auth
      mode='reset-confirm'
      status={status}
      onSubmit={handleSubmit}
      hint={hint ?? undefined}
      hintVariant='error'
    />
  )
}
