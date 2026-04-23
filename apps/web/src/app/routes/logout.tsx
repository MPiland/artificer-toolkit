import { Loader, Stack, Text } from '@mantine/core'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PublicShellFrame } from '#app/shell'
import { getSupabaseBrowserClient } from '../../supabase/client'

export const Route = createFileRoute('/logout')({
  component: LogoutPage
})

function LogoutPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function signOut() {
      await getSupabaseBrowserClient().auth.signOut()
      if (!cancelled) {
        await navigate({ to: '/login' })
      }
    }

    void signOut()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <PublicShellFrame
      eyebrow='Signing out'
      title='Closing the current session.'
      description='The route is intentionally light, but it exercises the same provider and auth infrastructure as the rest of the Phase 9 shell.'
      highlights={[
        'Uses the browser Supabase client.',
        'Redirects back into the new login surface.',
        'Keeps session control inside the platform slice.'
      ]}
    >
      <Stack align='center' gap='md'>
        <Loader />
        <Text c='dimmed'>Signing you out and returning to login…</Text>
      </Stack>
    </PublicShellFrame>
  )
}
