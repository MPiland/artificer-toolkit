import { Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordForm } from '#app/auth/AuthForms'
import { PublicShellFrame } from '#app/shell'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage
})

function ResetPasswordPage() {
  return (
    <PublicShellFrame
      eyebrow='Recovery'
      title='Send a secure password reset link.'
      description='Password recovery is active in the platform tranche so we can validate the shell and notification stack with a real auth flow.'
      highlights={[
        'Uses the same Supabase auth source as the rest of the app.',
        'Keeps notifications inside the shared provider tree.',
        'Will be visually upgraded with the Phase 9.2 auth redesign.'
      ]}
    >
      <Stack gap='lg'>
        <Text c='dimmed'>
          Enter the account email and we will send a reset link to the configured redirect surface.
        </Text>
        <ResetPasswordForm />
      </Stack>
    </PublicShellFrame>
  )
}
