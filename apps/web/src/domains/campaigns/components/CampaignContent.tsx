import { Alert, Badge, Button, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { useState } from 'react'
import type { CampaignContentShareDto, CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignContent } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { campaignContentTypeOptions, listOwnedCampaignContent } from '../campaignContentSubmission'
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
  const queryClient = useQueryClient()
  const [subjectKind, setSubjectKind] = useState<AuthoredSubjectKindDto | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const content = useQuery(getCampaignContent(campaign.id))
  const candidates = useQuery({
    queryKey: ['campaigns', campaign.id, 'content-candidates', subjectKind],
    queryFn: () => (subjectKind ? listOwnedCampaignContent(subjectKind) : Promise.resolve([])),
    enabled: subjectKind !== null && campaign.capabilities.shareOwnedContent
  })
  const share = useMutation({
    mutationFn: async () => {
      if (!subjectKind || !subjectId) throw new Error('Choose owned homebrew to share.')
      const candidate = candidates.data?.find((item) => item.subjectId === subjectId)
      if (!candidate) throw new Error('That owned homebrew record is no longer available.')
      return api.campaigns.content.share({
        campaignId: campaign.id,
        subjectKind,
        subjectId: candidate.subjectId
      })
    },
    onSuccess: async () => {
      setSubjectId(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.content(campaign.id) })
    }
  })
  const unshare = useMutation({
    mutationFn: (item: CampaignContentShareDto) =>
      api.campaigns.content.unshare({
        campaignId: campaign.id,
        subjectKind: item.subjectKind,
        subjectId: item.subjectId,
        sharedBy: item.sharedBy,
        expectedCampaignVersion: campaign.version,
        commandId: crypto.randomUUID()
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.content(campaign.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) })
      ])
    }
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
      {content.error ? <Alert color='red'>{content.error.message}</Alert> : null}
      {campaign.capabilities.shareOwnedContent ? (
        <Stack gap='sm'>
          <div>
            <Text fw={600}>Share owned homebrew</Text>
            <Text c='dimmed' size='sm'>
              Sharing grants current read and use access while you remain an active member.
            </Text>
          </div>
          {candidates.error || share.error || unshare.error ? (
            <Alert color='red'>{(candidates.error ?? share.error ?? unshare.error)?.message}</Alert>
          ) : null}
          <Group align='end' wrap='wrap'>
            <Select
              classNames={{ input: sharedStyles.input }}
              data={campaignContentTypeOptions}
              label='Content type'
              value={subjectKind}
              onChange={(value) => {
                setSubjectKind(value as AuthoredSubjectKindDto | null)
                setSubjectId(null)
              }}
            />
            <Select
              classNames={{ input: sharedStyles.input }}
              data={(candidates.data ?? []).map((candidate) => ({
                value: candidate.subjectId,
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
              disabled={!subjectId || content.isPending}
              loading={share.isPending}
              onClick={() => share.mutate()}
            >
              Share
            </Button>
          </Group>
        </Stack>
      ) : null}
      {(content.data ?? []).length === 0 ? (
        <Text c='dimmed'>No homebrew is shared with this Campaign.</Text>
      ) : null}
      <Stack gap='sm'>
        {content.data?.map((item) => (
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
    </section>
  )
}
