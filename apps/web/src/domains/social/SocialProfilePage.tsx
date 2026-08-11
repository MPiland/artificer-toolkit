import { Alert, Button, Group, Loader, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SocialReportDialog } from './components/SocialReportDialog'
import * as styles from './SocialProfilePage.css'

export function SocialProfilePage({ profilePublicId }: { profilePublicId: string }) {
  const queryClient = useQueryClient()
  const profile = useQuery({
    queryKey: queryKeys.socialHub.profile(profilePublicId),
    queryFn: () => api.socialHub.profiles.get(profilePublicId)
  })
  const eligibility = useQuery({
    queryKey: queryKeys.socialHub.eligibility(),
    queryFn: () => api.socialHub.eligibility.get()
  })
  const blocks = useQuery({
    queryKey: queryKeys.socialHub.blocks(),
    queryFn: () => api.socialHub.blocks.list()
  })
  const blocked = blocks.data?.some((entry) => entry.profile.profilePublicId === profilePublicId)
  const block = useMutation({
    mutationFn: () => api.socialHub.blocks.create(profilePublicId),
    onSuccess: () => {
      notifications.show({ message: 'Profile blocked in Social Hub.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
    }
  })
  const unblock = useMutation({
    mutationFn: () => api.socialHub.blocks.remove(profilePublicId),
    onSuccess: () => {
      notifications.show({ message: 'Social Hub block removed.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
    }
  })

  if (profile.isPending) return <Loader aria-label='Loading Social profile' size='sm' />
  if (profile.isError) return <Alert color='red'>This profile is unavailable.</Alert>
  const isSelf = eligibility.data?.profilePublicId === profilePublicId

  return (
    <section className={styles.narrowPage} aria-labelledby='social-profile-title'>
      <div className={styles.panel}>
        <Title id='social-profile-title' order={1}>
          @{profile.data.username}
        </Title>
        <Text c='dimmed'>Social Hub profile</Text>
        {blocks.isError ? <Alert color='red'>Block status is unavailable.</Alert> : null}
        {!isSelf ? (
          <Group gap='xs'>
            <Button
              color={blocked ? 'gray' : 'red'}
              loading={block.isPending || unblock.isPending}
              variant='default'
              onClick={() => (blocked ? unblock.mutate() : block.mutate())}
            >
              {blocked ? 'Unblock' : 'Block'}
            </Button>
            <SocialReportDialog target={{ targetKind: 'PROFILE', targetPublicId: profilePublicId }} />
          </Group>
        ) : null}
      </div>
    </section>
  )
}
