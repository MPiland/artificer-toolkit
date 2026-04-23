import { Button, Group, Stack, Text } from '@mantine/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import { PublicShellFrame } from '#app/shell'

export const Route = createFileRoute('/auth/confirmed')({
  component: AuthConfirmedPage
})

function AuthConfirmedPage() {
  return (
    <PublicShellFrame
      eyebrow='Confirmed'
      title='Your confirmation link has been accepted.'
      description='This route gives us a stable auth callback destination for the Phase 9 shell, even before the full marketing and auth polish pass.'
      highlights={[
        'Ready for confirmation and reset redirects.',
        'Lives inside the shared public shell.',
        'Provides a simple review surface for Playwright app smoke tests.'
      ]}
    >
      <Stack gap='lg'>
        <Text c='dimmed'>
          Continue into the login flow or head back to the marketing surface.
        </Text>
        <Group>
          <Button component={Link} to='/login'>
            Continue to login
          </Button>
          <Button component={Link} to='/' variant='default'>
            Back to homepage
          </Button>
        </Group>
      </Stack>
    </PublicShellFrame>
  )
}
