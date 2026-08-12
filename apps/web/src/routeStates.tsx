import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createClientOnlyFn } from '@tanstack/react-start'
import { useEffect } from 'react'
import IAlertCircle from '#assets/icons/IAlertCircle'
import IArrowLeft from '#assets/icons/IArrowLeft'
import IMapOff from '#assets/icons/IMapOff'
import { captureClientException } from '#app/observability/sentry.client'
import { routeLoadingMessage } from './routeLoadingMessages'
import { loadingCopy, loadingOverlay, loadingPanel, loadingSpinner } from './routeStates.css'

const captureRouteError = createClientOnlyFn((error: unknown) => {
  captureClientException(error)
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

export function RouteLoadingState() {
  return (
    <div className={loadingOverlay}>
      <div className={loadingPanel} role='status' aria-live='polite'>
        <span className={loadingSpinner} aria-hidden='true' />
        <p className={loadingCopy}>{routeLoadingMessage}</p>
      </div>
    </div>
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
