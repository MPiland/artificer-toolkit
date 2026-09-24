import { Alert, Button, Group, Loader, Text, Title } from '@mantine/core'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './SocialHubViews.css'

export function SocialBlocksPanel() {
  return (
    <section className={styles.panel} aria-labelledby='blocked-profiles-title'>
      <Title id='blocked-profiles-title' order={2}>
        Blocked profiles
      </Title>
      <CatchBoundary getResetKey={() => 'social-blocks'} errorComponent={SocialBlockListError}>
        <SocialBlockList />
      </CatchBoundary>
    </section>
  )
}

function SocialBlockList() {
  const queryClient = useQueryClient()
  const blocks = usePaginatedQuery(convexApi.social.blockLists.list, {}, { initialNumItems: 24 })
  const removeBlock = useConvexMutation(convexApi.social.blocks.remove)
  const remove = useMutation({
    mutationFn: (profilePublicId: string) => removeBlock({ profilePublicId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
  })

  return (
    <>
      {blocks.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading blocked profiles' size='sm' />
      ) : null}
      {blocks.results.map((block) => (
        <Group justify='space-between' key={block.profile.profilePublicId}>
          <Text>@{block.profile.username}</Text>
          <Button
            disabled={remove.isPending}
            loading={remove.isPending && remove.variables === block.profile.profilePublicId}
            size='xs'
            variant='default'
            onClick={() => remove.mutate(block.profile.profilePublicId)}
          >
            Unblock
          </Button>
        </Group>
      ))}
      {remove.error ? <Alert color='red'>{remove.error.message}</Alert> : null}
      {blocks.status === 'Exhausted' && blocks.results.length === 0 ? (
        <Text c='dimmed'>You have not blocked anyone.</Text>
      ) : null}
      {blocks.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => blocks.loadMore(24)}>
          Load more blocked profiles
        </Button>
      ) : null}
      {blocks.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more blocked profiles' size='sm' />
      ) : null}
    </>
  )
}

function SocialBlockListError() {
  return <Alert color='red'>Could not load blocked profiles.</Alert>
}
