import { Alert, Button, Group, Loader, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SocialReportDialog } from './components/SocialReportDialog'
import * as styles from './SocialProfilePage.css'

export function SocialProfilePage({ profilePublicId }: { profilePublicId: string }) {
  const queryClient = useQueryClient()
  const targetId = profilePublicId.toLowerCase()
  const eligibility = useQuery(convexQuery(convexApi.social.profiles.getEligibility, {}))
  const status = useQuery(
    convexQuery(convexApi.social.blocks.getStatus, { profilePublicId: targetId })
  )
  const profile = useQuery(
    convexQuery(
      convexApi.social.discovery.getProfile,
      status.data?.blocked === false ? { profilePublicId: targetId } : 'skip'
    )
  )
  const createBlock = useConvexMutation(convexApi.social.blocks.create)
  const removeBlock = useConvexMutation(convexApi.social.blocks.remove)
  const block = useMutation({
    mutationFn: () => createBlock({ profilePublicId: targetId }),
    onSuccess: () => {
      notifications.show({ message: 'Profile blocked in Social Hub.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
    }
  })
  const unblock = useMutation({
    mutationFn: () => removeBlock({ profilePublicId: targetId }),
    onSuccess: () => {
      notifications.show({ message: 'Social Hub block removed.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
    }
  })

  if (status.isPending || eligibility.isPending)
    return <Loader aria-label='Loading Social profile' size='sm' />
  if (status.isError || eligibility.isError)
    return <Alert color='red'>Block status is unavailable.</Alert>
  if (status.data.blocked)
    return (
      <section className={styles.narrowPage} aria-labelledby='social-profile-title'>
        <div className={styles.panel}>
          <Title id='social-profile-title' order={1}>
            Blocked profile
          </Title>
          <Text>You have blocked this profile in Social Hub.</Text>
          {unblock.isError ? (
            <Alert color='red'>The block could not be removed. Try again.</Alert>
          ) : null}
          <Group gap='xs'>
            <Button loading={unblock.isPending} variant='default' onClick={() => unblock.mutate()}>
              Unblock
            </Button>
            <SocialReportDialog target={{ targetKind: 'PROFILE', targetPublicId: targetId }} />
          </Group>
        </div>
      </section>
    )
  if (profile.isPending) return <Loader aria-label='Loading Social profile' size='sm' />
  if (profile.isError) return <Alert color='red'>This profile is unavailable.</Alert>
  const isSelf = eligibility.data.profilePublicId === targetId

  return (
    <section className={styles.narrowPage} aria-labelledby='social-profile-title'>
      <div className={styles.panel}>
        <Title id='social-profile-title' order={1}>
          @{profile.data.username}
        </Title>
        <Text c='dimmed'>Social Hub profile</Text>
        {block.isError ? (
          <Alert color='red'>The profile could not be blocked. Try again.</Alert>
        ) : null}
        {!isSelf ? (
          <Group gap='xs'>
            <Button
              color='red'
              loading={block.isPending}
              variant='default'
              onClick={() => block.mutate()}
            >
              Block
            </Button>
            <SocialReportDialog
              target={{ targetKind: 'PROFILE', targetPublicId: profilePublicId }}
            />
          </Group>
        ) : null}
      </div>
    </section>
  )
}
