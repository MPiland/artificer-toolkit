import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSupabaseBrowserClient } from '#supabase'

export const Route = createFileRoute('/logout')({
  preload: false,
  loader: async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    throw redirect({ to: '/login' })
  },
})
