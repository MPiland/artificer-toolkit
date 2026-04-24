import { Badge, Group, Text } from '@mantine/core'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShellFrame, platformNavigation } from '#app/shell'

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: AuthedLayout
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()

  return (
    <AppShellFrame
      title='Workspace foundation'
      description='This authenticated shell is the stable base for the list patterns, forms, builder, and sheet rebuilds that follow.'
      navigation={platformNavigation}
      headerActions={(
        <Group>
          <Badge variant='light'>SSR</Badge>
          <Text size='sm' c='dimmed'>
            {user?.email ?? 'Signed in'}
          </Text>
        </Group>
      )}
      sidebarFooter={(
        <Text size='sm' c='dimmed'>
          Phase 9.3 will replace this placeholder navigation with the locked list and app-shell patterns.
        </Text>
      )}
    >
      <Outlet />
    </AppShellFrame>
  )
}
