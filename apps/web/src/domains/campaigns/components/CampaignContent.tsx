import { Alert, Badge, Button, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { useState } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignContent } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import {
  campaignContentTypeOptions,
  listOwnedCampaignContent
} from '../campaignContentSubmission'
import * as sharedStyles from '../campaigns.css'
import * as contentStyles from './campaignContent.css'

export function CampaignContent({ campaign }: { campaign: CampaignDetailDto }) {
  const queryClient = useQueryClient()
  const [subjectKind, setSubjectKind] = useState<AuthoredSubjectKindDto | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const content = useQuery(getCampaignContent(campaign.id))
  const candidates = useQuery({
    queryKey: ['campaigns', campaign.id, 'content-candidates', subjectKind],
    queryFn: () => (subjectKind ? listOwnedCampaignContent(subjectKind) : Promise.resolve([])),
    enabled: subjectKind !== null && campaign.capabilities.submitContent
  })
  const submit = useMutation({
    mutationFn: async () => {
      if (!subjectKind || !subjectId) throw new Error('Choose owned homebrew to submit.')
      const candidate = candidates.data?.find((item) => item.subjectId === subjectId)
      if (!candidate) throw new Error('That owned homebrew record is no longer available.')
      const latestVersion = Math.max(
        0,
        ...(content.data ?? [])
          .filter(
            (version) =>
              version.subjectKind === subjectKind && version.subjectId === candidate.subjectId
          )
          .map((version) => version.version)
      )
      return api.campaigns.content.submit({
        campaignId: campaign.id,
        subjectKind,
        subjectId: candidate.subjectId,
        expectedRevision: latestVersion + 1
      })
    },
    onSuccess: async () => {
      setSubjectId(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.content(campaign.id) })
    }
  })
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
    <section className={sharedStyles.panel} aria-labelledby='campaign-content-title'>
      <div>
        <Title order={2} id='campaign-content-title'>
          Campaign content
        </Title>
        <Text c='dimmed' size='sm'>
          Immutable authored versions submitted to this Campaign.
        </Text>
      </div>
      {content.error ? <Alert color='red'>{content.error.message}</Alert> : null}
      {campaign.capabilities.submitContent ? (
        <Stack gap='sm'>
          <div>
            <Text fw={600}>Submit owned homebrew</Text>
            <Text c='dimmed' size='sm'>
              Send an active homebrew record to the GM for this Campaign.
            </Text>
          </div>
          {candidates.error || submit.error ? (
            <Alert color='red'>{(candidates.error ?? submit.error)?.message}</Alert>
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
              loading={submit.isPending}
              onClick={() => submit.mutate()}
            >
              Submit
            </Button>
          </Group>
        </Stack>
      ) : null}
      {(content.data ?? []).length === 0 ? (
        <Text c='dimmed'>No Campaign content versions.</Text>
      ) : null}
      <Stack gap='sm'>
        {content.data?.map((version) => (
          <div className={sharedStyles.memberRow} key={version.id}>
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
