import { Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '#app/auth/AuthForms'
import { PublicShellFrame } from '#app/shell'

export const Route = createFileRoute('/login')({
  component: LoginPage
})

function LoginPage() {
  return (
    <PublicShellFrame
      eyebrow='Authentication'
      title='Sign in to the rebuild workspace.'
      description='This is the platform tranche version of auth: the shell, providers, and Supabase flow are live so we can review the foundation before polishing the Figma-auth surfaces.'
      highlights={[
        'Supabase session flow stays in the browser for now.',
        'Notifications and shared providers are part of the base shell.',
        'The full marketing/auth visual pass lands in Phase 9.2.'
      ]}
    >
      <Stack gap='lg'>
        <Text c='dimmed'>
          Sign in to access the authenticated shell and verify the SSR-aware route foundation.
        </Text>
        <LoginForm />
      </Stack>
    </PublicShellFrame>
  )
}
