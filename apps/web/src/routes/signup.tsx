import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Auth } from '#auth'
import { getSupabaseBrowserClient } from '#supabase'

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    if (context.user) throw redirect({ to: '/home' })
  },
  component: SignupPage,
})

function SignupPage() {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [hint, setHint] = useState<string | null>(null)
  const [hintVariant, setHintVariant] = useState<'error' | 'info'>('error')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string

    setStatus('pending')
    setHint(null)

    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setStatus('error')
      const code = (error as any).code as string | undefined
      if (code === 'user_already_exists' || code === 'email_address_already_registered') {
        setHint('An account with this email already exists.')
      } else {
        setHint(error.message)
      }
      setHintVariant('error')
      return
    }

    // Auto-confirmed (local dev)
    if (data.session) {
      throw redirect({ to: '/home' })
    }

    // Confirmation email sent
    setStatus('success')
    setHintVariant('info')
    setHint('Check your email for a confirmation link to activate your account.')
  }

  return (
    <Auth
      mode='signup'
      status={status === 'success' ? 'idle' : status}
      onSubmit={handleSubmit}
      hint={hint ?? undefined}
      hintVariant={hintVariant}
    />
  )
}
