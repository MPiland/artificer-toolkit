import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import IAlertCircle from '#assets/icons/IAlertCircle'
import IArrowLeft from '#assets/icons/IArrowLeft'
import IMapOff from '#assets/icons/IMapOff'
import { routeLoadingMessages } from './routeLoadingMessages'
import { loadingCopy, loadingOverlay, loadingPanel, loadingSpinner } from './routeStates.css'

const routeLoadingIntervalMs = 1800

export function RouteNotFound() {
  const homeRoute = useHomeRoute()

  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <IMapOff size={48} />
      <Title order={1}>Route not found</Title>
      <Text c='dimmed' ta='center' maw={420}>
        This route is not available in the MVP UAT build.
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

export function RouteLoadingState() {
  const [messageIndex, setMessageIndex] = useState(0)
  const message = routeLoadingMessages[messageIndex] ?? routeLoadingMessages[0]

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % routeLoadingMessages.length)
    }, routeLoadingIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className={loadingOverlay}>
      <div className={loadingPanel} role='status' aria-live='polite'>
        <span className={loadingSpinner} aria-hidden='true' />
        <p className={loadingCopy}>{message}</p>
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
