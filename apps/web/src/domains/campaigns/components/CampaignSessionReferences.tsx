import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { IconTrash } from '@tabler/icons-react'
import { useConvex, usePaginatedQuery } from 'convex/react'
import { useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionReferencePinDto } from '@artificer-toolkit/schema/api/campaignSessions'
import {
  authoredReferenceSubjectOptions,
  campaignSessionReferenceHref,
  type AuthoredReferenceTarget
} from './campaignSessionReferences.model'
import { findOption } from '../../../forms/utils/valueGuards'
import * as sharedStyles from '../campaigns.css'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionReferences({
  campaign,
  sessionId,
  editable = true
}: {
  campaign: CampaignDetailDto
  sessionId: string
  editable?: boolean
}) {
  const convex = useConvex()
  const references = usePaginatedQuery(
    convexApi.campaigns.sessionReferences.list,
    { campaignId: campaign.id, sessionId },
    { initialNumItems: 4 }
  )
  const notebook = usePaginatedQuery(
    convexApi.campaigns.notebooks.list,
    { campaignId: campaign.id },
    { initialNumItems: 8 }
  )
  const [adding, setAdding] = useState(false)
  const [targetKind, setTargetKind] = useState<'CAMPAIGN_NOTE' | 'AUTHORED_ROUTE'>('CAMPAIGN_NOTE')
  const [noteSectionId, setNoteSectionId] = useState<string | null>(null)
  const [routeSubjectKind, setRouteSubjectKind] =
    useState<AuthoredReferenceTarget['routeSubjectKind']>('CREATURE')
  const [publicId, setPublicId] = useState('')
  const create = useMutation({
    mutationFn: (target: CampaignSessionReferencePinDto['target']) =>
      convex.mutation(convexApi.campaigns.sessionReferences.create, {
        campaignId: campaign.id,
        sessionId,
        target
      }),
    onSuccess: () => {
      setAdding(false)
      setNoteSectionId(null)
      setPublicId('')
    }
  })
  const remove = useMutation({
    mutationFn: (pinId: string) =>
      convex.mutation(convexApi.campaigns.sessionReferences.remove, {
        campaignId: campaign.id,
        sessionId,
        pinId
      })
  })

  function addReference() {
    if (targetKind === 'CAMPAIGN_NOTE') {
      if (noteSectionId) create.mutate({ kind: 'CAMPAIGN_NOTE', noteSectionId })
      return
    }
    const normalizedPublicId = publicId.trim().toLowerCase()
    if (normalizedPublicId) {
      create.mutate({
        kind: 'AUTHORED_ROUTE',
        routeSubjectKind,
        publicId: normalizedPublicId
      })
    }
  }

  return (
    <Stack gap='sm'>
      <Group align='flex-start' justify='space-between'>
        <div>
          <Text fw={700}>Pinned references</Text>
          <Text c='dimmed' size='sm'>
            Pin notes and rules for this session.
          </Text>
        </div>
        {editable && !adding ? (
          <Button size='compact-sm' variant='subtle' onClick={() => setAdding(true)}>
            Add reference
          </Button>
        ) : null}
      </Group>
      {references.status === 'LoadingFirstPage' ? (
        <Text c='dimmed'>Loading references…</Text>
      ) : null}
      {references.results.length ? (
        <Stack gap='xs'>
          {references.results.map((reference) => (
            <Group
              className={sessionsStyles.sessionReferenceRow}
              key={reference.id}
              justify='space-between'
            >
              <Group gap='xs'>
                <Anchor fw={600} href={campaignSessionReferenceHref(campaign, reference)}>
                  {reference.label}
                </Anchor>
                <Badge color='gray' size='xs' variant='light'>
                  {reference.target.kind === 'CAMPAIGN_NOTE'
                    ? 'Campaign note'
                    : reference.target.routeSubjectKind.toLowerCase()}
                </Badge>
              </Group>
              {editable ? (
                <Tooltip label={`Remove ${reference.label}`}>
                  <ActionIcon
                    aria-label={`Remove ${reference.label}`}
                    color='red'
                    disabled={remove.isPending}
                    variant='subtle'
                    onClick={() => remove.mutate(reference.id)}
                  >
                    <IconTrash aria-hidden size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Group>
          ))}
        </Stack>
      ) : references.status !== 'LoadingFirstPage' ? (
        <Text c='dimmed' size='sm'>
          No references pinned.
        </Text>
      ) : null}
      {references.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => references.loadMore(4)}>
          Load more references
        </Button>
      ) : null}
      {adding ? (
        <Stack className={sessionsStyles.sessionReferenceEditor} gap='sm'>
          <SegmentedControl
            data={[
              { label: 'Campaign note', value: 'CAMPAIGN_NOTE' },
              { label: 'Authored record', value: 'AUTHORED_ROUTE' }
            ]}
            value={targetKind}
            onChange={(value) =>
              setTargetKind(findOption(['CAMPAIGN_NOTE', 'AUTHORED_ROUTE'], value) ?? targetKind)
            }
          />
          {targetKind === 'CAMPAIGN_NOTE' ? (
            <Stack gap='xs'>
              <Select
                classNames={{ input: sharedStyles.input }}
                data={notebook.results.map((section) => ({
                  label: section.title,
                  value: section.id
                }))}
                label='Campaign note'
                placeholder={
                  notebook.status === 'LoadingFirstPage' ? 'Loading notes…' : 'Choose a note'
                }
                searchable
                value={noteSectionId}
                onChange={setNoteSectionId}
              />
              {notebook.status === 'CanLoadMore' ? (
                <Button type='button' variant='subtle' onClick={() => notebook.loadMore(8)}>
                  Load more notes
                </Button>
              ) : null}
            </Stack>
          ) : (
            <Group align='end' grow wrap='wrap'>
              <Select
                classNames={{ input: sharedStyles.input }}
                data={authoredReferenceSubjectOptions}
                label='Record type'
                value={routeSubjectKind}
                onChange={(value) =>
                  setRouteSubjectKind(
                    authoredReferenceSubjectOptions.find((option) => option.value === value)
                      ?.value ?? 'CREATURE'
                  )
                }
              />
              <TextInput
                classNames={{ input: sharedStyles.input }}
                label='Public ID'
                placeholder='Random route ID'
                value={publicId}
                onChange={(event) => setPublicId(event.currentTarget.value)}
              />
            </Group>
          )}
          {create.error ? <Alert color='red'>That reference is unavailable.</Alert> : null}
          <Group justify='flex-end'>
            <Button variant='subtle' onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                targetKind === 'CAMPAIGN_NOTE' ? !noteSectionId : publicId.trim().length === 0
              }
              loading={create.isPending}
              onClick={addReference}
            >
              Add reference
            </Button>
          </Group>
        </Stack>
      ) : null}
      {remove.error ? <Alert color='red'>That reference couldn’t be removed.</Alert> : null}
    </Stack>
  )
}
