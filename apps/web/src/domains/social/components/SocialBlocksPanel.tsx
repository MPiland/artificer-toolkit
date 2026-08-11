import { Alert, Button, Group, Loader, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './SocialHubViews.css'

export function SocialBlocksPanel() {
  const queryClient = useQueryClient()
  const blocks = useQuery({
    queryKey: queryKeys.socialHub.blocks(),
    queryFn: () => api.socialHub.blocks.list()
  })
  const remove = useMutation({
    mutationFn: (profilePublicId: string) => api.socialHub.blocks.remove(profilePublicId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.blocks() })
  })

  return (
    <section className={styles.panel} aria-labelledby='blocked-profiles-title'>
      <Title id='blocked-profiles-title' order={2}>
        Blocked profiles
      </Title>
      {blocks.isPending ? <Loader aria-label='Loading blocked profiles' size='sm' /> : null}
      {blocks.isError ? <Alert color='red'>Could not load blocked profiles.</Alert> : null}
      {blocks.data?.length === 0 ? <Text c='dimmed'>You have not blocked anyone.</Text> : null}
      {blocks.data?.map((block) => (
        <Group justify='space-between' key={block.profile.profilePublicId}>
          <Text>@{block.profile.username}</Text>
          <Button
            loading={remove.isPending && remove.variables === block.profile.profilePublicId}
            size='xs'
            variant='default'
            onClick={() => remove.mutate(block.profile.profilePublicId)}
          >
            Unblock
          </Button>
        </Group>
      ))}
    </section>
  )
}
