import { Alert, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createClientOnlyFn } from '@tanstack/react-start'
import { useEffect } from 'react'
import IAlertCircle from '#assets/icons/IAlertCircle'
import IArrowLeft from '#assets/icons/IArrowLeft'
import IMapOff from '#assets/icons/IMapOff'
import { routeLoadingMessage } from './routeLoadingMessages'

// Imported lazily so the browser Sentry SDK, whose Worker export pulls in @sentry/node, stays out of
// the Worker SSR bundle (ADR 0037) without relying on the Start compiler pruning a static import.
const captureRouteError = createClientOnlyFn((error: unknown) => {
  void import('#app/observability/sentry.client').then(({ captureClientException }) =>
    captureClientException(error)
  )
})

export function RouteNotFound() {
  const homeRoute = useHomeRoute()

  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <IMapOff size={48} />
      <Title order={1}>Page not found</Title>
      <Text c='dimmed' ta='center' maw={420}>
        The page may have moved, or the link may be incorrect.
      </Text>
      <Button component={Link} to={homeRoute} leftSection={<IArrowLeft size={16} />}>
        Return home
      </Button>
    </Stack>
  )
}

export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const homeRoute = useHomeRoute()
  const queryClient = useQueryClient()

  useEffect(() => {
    captureRouteError(error)
  }, [error])

  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <Alert
        icon={<IAlertCircle size={18} />}
        title="This page couldn't load"
        color='red'
        maw={560}
      >
        Try again. If the problem continues, return to the homepage.
      </Alert>
      <Group>
        <Button
          variant='default'
          onClick={() => {
            void queryClient
              .resetQueries({ predicate: (query) => query.state.status === 'error' })
              .finally(reset)
          }}
        >
          Try again
        </Button>
        <Button component={Link} to={homeRoute} leftSection={<IArrowLeft size={16} />}>
          Go to homepage
        </Button>
      </Group>
    </Stack>
  )
}

export function RouteLoadingState() {
  return (
    <Stack role='status' aria-label={routeLoadingMessage} gap='md' p='md'>
      <Skeleton height={32} width='40%' />
      <Skeleton height={16} width='70%' />
      <Skeleton height={16} width='55%' />
      <Skeleton height={240} />
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
