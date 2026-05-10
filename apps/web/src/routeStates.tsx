import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import IAlertCircle from '#assets/icons/IAlertCircle'
import IArrowLeft from '#assets/icons/IArrowLeft'
import IMapOff from '#assets/icons/IMapOff'

export function RouteNotFound() {
  const homeRoute = useHomeRoute()

  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <IMapOff size={48} />
      <Title order={1}>Route not found</Title>
      <Text c='dimmed' ta='center' maw={420}>
        The Phase 9 app shell is active, so some provisional legacy routes are intentionally offline while
        we rebuild the frontend foundation.
      </Text>
      <Button component={Link} to={homeRoute} leftSection={<IArrowLeft size={16} />}>
        Return home
      </Button>
    </Stack>
  )
}

export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const homeRoute = useHomeRoute()

  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <Alert
        icon={<IAlertCircle size={18} />}
        title='Route error'
        color='red'
        maw={560}
      >
        {error instanceof Error ? error.message : 'An unexpected route error occurred.'}
      </Alert>
      <Group>
        <Button variant='default' onClick={reset}>
          Try again
        </Button>
        <Button component={Link} to={homeRoute} leftSection={<IArrowLeft size={16} />}>
          Go to homepage
        </Button>
      </Group>
    </Stack>
  )
}

function useHomeRoute() {
  const router = useRouter()
  const hasAuthenticatedMatch = useRouterState({
    select: (state) => state.matches.some((match) => Boolean(match.context.user))
  })
  const isAuthenticated = hasAuthenticatedMatch || Boolean(router.options.context.user)

  return isAuthenticated ? '/home' : '/'
}
