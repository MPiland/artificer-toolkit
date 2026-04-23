import { Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { SignupForm } from '#app/auth/AuthForms'
import { PublicShellFrame } from '#app/shell'

export const Route = createFileRoute('/signup')({
  component: SignupPage
})

function SignupPage() {
  return (
    <PublicShellFrame
      eyebrow='Account setup'
      title='Create an account for the new frontend.'
      description='The sign-up flow is deliberately simple in this tranche so we can validate auth plumbing and shell behavior before the dedicated public/auth polish pass.'
      highlights={[
        'Shared providers are the same as the app shell.',
        'Supabase confirmation emails remain the source of truth.',
        'Phase 9.2 will replace this with the locked auth presentation.'
      ]}
    >
      <Stack gap='lg'>
        <Text c='dimmed'>
          Create an account to test the new public/auth shell path and session handoff.
        </Text>
        <SignupForm />
      </Stack>
    </PublicShellFrame>
  )
}
