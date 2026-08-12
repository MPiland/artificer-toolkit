import { Alert, Loader, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './SocialEligibility.css'

export function SocialEligibility() {
  const queryClient = useQueryClient()
  const eligibility = useQuery({
    queryKey: queryKeys.socialHub.eligibility(),
    queryFn: () => api.socialHub.eligibility.get()
  })
  const initialize = useMutation({
    mutationFn: () => api.socialHub.eligibility.initialize(),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.socialHub.eligibility(), result)
    }
  })
  const initializeProfile = initialize.mutate

  useEffect(() => {
    if (eligibility.data?.status === null && initialize.isIdle) initializeProfile()
  }, [eligibility.data?.status, initialize.isIdle, initializeProfile])

  if (eligibility.isPending) {
    return <Loader aria-label='Loading Social Hub' size='sm' />
  }

  if (eligibility.isError) {
    return <Alert color='red'>Social Hub is unavailable. Reload the page to try again.</Alert>
  }

  if (eligibility.data.status === 'SUSPENDED') {
    return (
      <section className={styles.narrowPage} aria-labelledby='social-unavailable-title'>
        <div className={styles.panel}>
          <Title id='social-unavailable-title' order={1}>
            Social Hub unavailable
          </Title>
          <Text c='dimmed'>This account cannot currently use Social Hub.</Text>
        </div>
      </section>
    )
  }

  if (initialize.isError) {
    return (
      <section className={styles.narrowPage} aria-labelledby='social-unavailable-title'>
        <div className={styles.panel}>
          <Title id='social-unavailable-title' order={1}>
            Social Hub unavailable
          </Title>
          <Alert color='red'>
            {initialize.error.message}{' '}
            <Link to='/settings/profile'>Check your username in profile settings.</Link>
          </Alert>
        </div>
      </section>
    )
  }

  if (!eligibility.data.eligible) {
    return <Loader aria-label='Preparing Social Hub' size='sm' />
  }

  return <Outlet />
}
