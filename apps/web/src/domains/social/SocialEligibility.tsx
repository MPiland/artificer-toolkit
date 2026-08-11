import { Alert, Button, Checkbox, Loader, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { type SubmitEvent, useState } from 'react'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { latestAdultBirthDate } from './socialAge'
import * as styles from './SocialEligibility.css'

export function SocialEligibility() {
  const queryClient = useQueryClient()
  const eligibility = useQuery({
    queryKey: queryKeys.socialHub.eligibility(),
    queryFn: () => api.socialHub.eligibility.get()
  })
  const [birthDate, setBirthDate] = useState('')
  const [isCurrentlyInUs, setIsCurrentlyInUs] = useState(false)
  const needsAdultAttestation = !eligibility.data?.adultAttestedAt
  const accept = useMutation({
    mutationFn: () =>
      api.socialHub.eligibility.accept({
        ...(needsAdultAttestation ? { birthDate } : {}),
        isCurrentlyInUs: true
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.socialHub.eligibility(), result)
    }
  })

  if (eligibility.isPending) {
    return <Loader aria-label='Loading Social Hub eligibility' size='sm' />
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

  if (!eligibility.data.eligible) {
    return (
      <section className={styles.narrowPage} aria-labelledby='social-eligibility-title'>
        <div className={styles.panel}>
          <Title id='social-eligibility-title' order={1}>
            Before you join Social Hub
          </Title>
          <Text c='dimmed'>
            Social Hub is currently limited to adults who are in the United States. Verify your age
            and confirm your current location to continue.
          </Text>
          <form
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault()
              if ((!needsAdultAttestation || birthDate) && isCurrentlyInUs) accept.mutate()
            }}
          >
            <Stack>
              {needsAdultAttestation ? (
                <TextInput
                  required
                  description='Used once to verify your age.'
                  label='Date of birth'
                  max={latestAdultBirthDate()}
                  type='date'
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.currentTarget.value)}
                />
              ) : (
                <Text size='sm'>Your age has already been verified.</Text>
              )}
              <Checkbox
                checked={isCurrentlyInUs}
                label='I am currently in the United States.'
                onChange={(event) => setIsCurrentlyInUs(event.currentTarget.checked)}
              />
              {accept.error ? (
                <Alert color='red'>
                  {accept.error.message}{' '}
                  <Link to='/settings/profile'>Check your username in profile settings.</Link>
                </Alert>
              ) : null}
              <Button
                disabled={(needsAdultAttestation && !birthDate) || !isCurrentlyInUs}
                loading={accept.isPending}
                type='submit'
              >
                Continue to Social Hub
              </Button>
            </Stack>
          </form>
        </div>
      </section>
    )
  }

  return <Outlet />
}
