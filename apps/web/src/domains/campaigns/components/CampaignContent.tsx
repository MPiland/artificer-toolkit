import { Alert, Badge, Button, Group, Loader, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import type {
  CampaignContentShareDto,
  CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import { campaignContentTypeOptions } from '../campaignContentSubmission'
import * as sharedStyles from '../campaigns.css'
import * as contentStyles from './campaignContent.css'

function shareLabel(share: CampaignContentShareDto): string {
  const document = share.document
  return document &&
    typeof document === 'object' &&
    !Array.isArray(document) &&
    'label' in document &&
    typeof document.label === 'string'
    ? document.label
    : share.subjectId
}

export function CampaignContent({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const [subjectKind, setSubjectKind] = useState<AuthoredSubjectKindDto | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const content = usePaginatedQuery(
    convexApi.campaigns.contentShares.list,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  // The kind only matters once chosen; until then the read is disabled.
  const candidates = useContentCatalogue(subjectKind ?? 'CLASS', {
    enabled: Boolean(subjectKind) && campaign.capabilities.shareOwnedContent,
    source: 'OWNED'
  })
  const candidateItems = candidates.items ?? []
  const shareContent = useConvexMutation(convexApi.campaigns.contentShares.share)
  const unshareContent = useConvexMutation(convexApi.campaigns.contentShares.unshare)

  const share = useMutation({
    mutationFn: async () => {
      if (!subjectKind || !subjectId) throw new Error('Choose owned homebrew to share.')
      const candidate = candidateItems.find((item) => item.id === subjectId)
      if (!candidate) throw new Error('That owned homebrew record is no longer available.')
      return shareContent({
        campaignId: campaign.id,
        subjectKind,
        subjectId: candidate.id
      })
    },
    onSuccess: () => setSubjectId(null)
  })
  const unshare = useMutation({
    mutationFn: (item: CampaignContentShareDto) =>
      unshareContent({
        campaignId: campaign.id,
        subjectKind: item.subjectKind,
        subjectId: item.subjectId,
        sharedBy: item.sharedBy,
        expectedCampaignVersion: campaign.version,
        commandId: crypto.randomUUID()
      })
  })

  return (
    <section className={sharedStyles.panel} aria-labelledby='campaign-content-title'>
      <div>
        <Title order={2} id='campaign-content-title'>
          Campaign content
        </Title>
        <Text c='dimmed' size='sm'>
          Members can immediately share active homebrew they own with this Campaign.
        </Text>
      </div>
      {content.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading Campaign content' size='sm' />
      ) : null}
      {campaign.capabilities.shareOwnedContent ? (
        <Stack gap='sm'>
          <div>
            <Text fw={600}>Share owned homebrew</Text>
            <Text c='dimmed' size='sm'>
              Sharing grants current read and use access while you remain an active member.
            </Text>
          </div>
          {share.error || unshare.error ? (
            <Alert color='red'>{share.error?.message ?? unshare.error?.message}</Alert>
          ) : null}
          <Group align='end' wrap='wrap'>
            <Select
              classNames={{ input: sharedStyles.input }}
              data={campaignContentTypeOptions}
              label='Content type'
              value={subjectKind}
              onChange={(value) => {
                setSubjectKind(
                  campaignContentTypeOptions.find((option) => option.value === value)?.value ?? null
                )
                setSubjectId(null)
              }}
            />
            <Select
              classNames={{ input: sharedStyles.input }}
              data={candidateItems.map((candidate) => ({
                value: candidate.id,
                label: candidate.label
              }))}
              disabled={!subjectKind || candidates.isPending}
              label='Owned homebrew'
              searchable
              value={subjectId}
              onChange={setSubjectId}
            />
            <Button
              className={contentStyles.inputRowButton}
              disabled={!subjectId || content.status === 'LoadingFirstPage'}
              loading={share.isPending}
              onClick={() => share.mutate()}
            >
              Share
            </Button>
          </Group>
        </Stack>
      ) : null}
      {content.status === 'Exhausted' && content.results.length === 0 ? (
        <Text c='dimmed'>No homebrew is shared with this Campaign.</Text>
      ) : null}
      <Stack gap='sm'>
        {content.results.map((item) => (
          <div className={sharedStyles.memberRow} key={`${item.subjectKind}:${item.subjectId}`}>
            <div>
              <Group gap='xs'>
                <Text fw={600}>{shareLabel(item)}</Text>
                <Badge color='green'>Shared</Badge>
              </Group>
              <Text c='dimmed' size='sm'>
                {item.subjectKind} · shared by {item.sharedBy}
              </Text>
            </div>
            {campaign.status === 'ACTIVE' &&
            (campaign.capabilities.manageSharedContent || item.sharedBy === currentUserId) ? (
              <Button
                color='red'
                loading={
                  unshare.isPending &&
                  unshare.variables?.subjectKind === item.subjectKind &&
                  unshare.variables.subjectId === item.subjectId
                }
                variant='subtle'
                onClick={() => unshare.mutate(item)}
              >
                Remove share
              </Button>
            ) : null}
          </div>
        ))}
      </Stack>
      {content.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => content.loadMore(48)}>
          Load more content
        </Button>
      ) : null}
      {content.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more Campaign content' size='sm' />
      ) : null}
    </section>
  )
}
