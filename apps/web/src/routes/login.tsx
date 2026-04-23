import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { Auth } from '#auth'
import { getSupabaseBrowserClient } from '#supabase'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (context.user) throw redirect({ to: '/home' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [hint, setHint] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string

    setStatus('pending')
    setHint(null)

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStatus('error')
      const code = (error as any).code as string | undefined
      if (code === 'email_not_confirmed') {
        setHint('Email not confirmed. Check your inbox or request a new link.')
      } else if (code === 'invalid_credentials') {
        setHint('Invalid email or password.')
      } else {
        setHint(error.message)
      }
      return
    }

    notifications.show({ message: 'Welcome back!', color: 'teal', autoClose: 2000 })
    await router.navigate({ to: '/home' })
  }

  return (
    <Auth
      mode='login'
      status={status}
      onSubmit={handleSubmit}
      hint={hint ?? undefined}
      hintVariant='error'
    />
  )
}
