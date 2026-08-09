import { Alert, Badge, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignContent } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from '../campaigns.css'

export function CampaignContent({ campaign }: { campaign: CampaignDetailDto }) {
  const queryClient = useQueryClient()
  const content = useQuery(getCampaignContent(campaign.id))
  const review = useMutation({
    mutationFn: ({
      contentVersionId,
      decision
    }: {
      contentVersionId: string
      decision: 'APPROVE' | 'REJECT'
    }) =>
      api.campaigns.content.review({
        campaignId: campaign.id,
        contentVersionId,
        decision
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.content(campaign.id)
      })
  })

  return (
    <section className={styles.panel} aria-labelledby='campaign-content-title'>
      <div>
        <Title order={2} id='campaign-content-title'>
          Campaign content
        </Title>
        <Text c='dimmed' size='sm'>
          Immutable snapshots submitted to this Campaign.
        </Text>
      </div>
      {content.error ? <Alert color='red'>{content.error.message}</Alert> : null}
      {(content.data ?? []).length === 0 ? (
        <Text c='dimmed'>No Campaign content versions.</Text>
      ) : null}
      <Stack gap='sm'>
        {content.data?.map((version) => (
          <div className={styles.memberRow} key={version.id}>
            <div>
              <Group gap='xs'>
                <Text fw={600}>{version.subjectKind}</Text>
                <Badge
                  color={
                    version.status === 'APPROVED'
                      ? 'green'
                      : version.status === 'REJECTED'
                        ? 'red'
                        : 'yellow'
                  }
                >
                  {version.status}
                </Badge>
              </Group>
              <Text c='dimmed' size='sm'>
                Version {version.version} · {version.subjectId}
              </Text>
            </div>
            {campaign.capabilities.manageContent && version.status === 'PENDING' ? (
              <Group gap='xs'>
                <Button
                  size='xs'
                  loading={review.isPending}
                  onClick={() =>
                    review.mutate({
                      contentVersionId: version.id,
                      decision: 'APPROVE'
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  color='red'
                  size='xs'
                  variant='outline'
                  loading={review.isPending}
                  onClick={() =>
                    review.mutate({
                      contentVersionId: version.id,
                      decision: 'REJECT'
                    })
                  }
                >
                  Reject
                </Button>
              </Group>
            ) : null}
          </div>
        ))}
      </Stack>
    </section>
  )
}
