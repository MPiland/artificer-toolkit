import {
  ActionIcon,
  Alert,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { CampaignDetailDto, CampaignSessionReferencePinDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignNotebook, getCampaignSessionReferences } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import {
  authoredReferenceSubjectOptions,
  type AuthoredReferenceTarget
} from './campaignSessionReferences.model'
import * as styles from '../campaigns.css'

export function CampaignSessionReferences({
  campaign,
  sessionId,
  editable = true
}: {
  campaign: CampaignDetailDto
  sessionId: string
  editable?: boolean
}) {
  const queryClient = useQueryClient()
  const references = useQuery(getCampaignSessionReferences(campaign.id, sessionId))
  const notebook = useQuery(getCampaignNotebook(campaign.id))
  const [adding, setAdding] = useState(false)
  const [targetKind, setTargetKind] = useState<'CAMPAIGN_NOTE' | 'AUTHORED_ROUTE'>('CAMPAIGN_NOTE')
  const [noteSectionId, setNoteSectionId] = useState<string | null>(null)
  const [routeSubjectKind, setRouteSubjectKind] =
    useState<AuthoredReferenceTarget['routeSubjectKind']>('CREATURE')
  const [publicId, setPublicId] = useState('')
  const create = useMutation({
    mutationFn: (target: CampaignSessionReferencePinDto['target']) =>
      api.campaigns.sessions.references.create({ campaignId: campaign.id, sessionId, target }),
    onSuccess: async () => {
      setAdding(false)
      setNoteSectionId(null)
      setPublicId('')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionReferences(campaign.id, sessionId)
      })
    }
  })
  const remove = useMutation({
    mutationFn: (pinId: string) =>
      api.campaigns.sessions.references.delete(campaign.id, sessionId, pinId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionReferences(campaign.id, sessionId)
      })
  })

  function addReference() {
    if (targetKind === 'CAMPAIGN_NOTE') {
      if (noteSectionId) create.mutate({ kind: 'CAMPAIGN_NOTE', noteSectionId })
      return
    }
    const normalizedPublicId = publicId.trim().toLowerCase()
    if (normalizedPublicId) {
      create.mutate({ kind: 'AUTHORED_ROUTE', routeSubjectKind, publicId: normalizedPublicId })
    }
  }

  return (
    <Stack gap='sm'>
      <Group align='flex-start' justify='space-between'>
        <div>
          <Text fw={700}>Pinned references</Text>
          <Text c='dimmed' size='sm'>
            Keep the notes and records you expect to reach for during play.
          </Text>
        </div>
        {editable && !adding ? (
          <Button size='compact-sm' variant='subtle' onClick={() => setAdding(true)}>
            Add reference
          </Button>
        ) : null}
      </Group>
      {references.isPending ? <Text c='dimmed'>Loading references…</Text> : null}
      {references.error ? <Alert color='red'>References couldn’t be loaded.</Alert> : null}
      {references.data?.length ? (
        <Stack gap='xs'>
          {references.data.map((reference) => (
            <Group
              className={styles.sessionReferenceRow}
              key={reference.id}
              justify='space-between'
            >
              <Group gap='xs'>
                <Text fw={600}>{reference.label}</Text>
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
      ) : !references.isPending && !references.error ? (
        <Text c='dimmed' size='sm'>
          No references pinned.
        </Text>
      ) : null}
      {adding ? (
        <Stack className={styles.sessionReferenceEditor} gap='sm'>
          <SegmentedControl
            data={[
              { label: 'Campaign note', value: 'CAMPAIGN_NOTE' },
              { label: 'Authored record', value: 'AUTHORED_ROUTE' }
            ]}
            value={targetKind}
            onChange={(value) => setTargetKind(value as typeof targetKind)}
          />
          {targetKind === 'CAMPAIGN_NOTE' ? (
            <Select
              classNames={{ input: styles.input }}
              data={(notebook.data ?? []).map((section) => ({
                label: section.title,
                value: section.id
              }))}
              label='Campaign note'
              placeholder={notebook.isPending ? 'Loading notes…' : 'Choose a note'}
              searchable
              value={noteSectionId}
              onChange={setNoteSectionId}
            />
          ) : (
            <Group align='end' grow wrap='wrap'>
              <Select
                classNames={{ input: styles.input }}
                data={authoredReferenceSubjectOptions}
                label='Record type'
                value={routeSubjectKind}
                onChange={(value) =>
                  setRouteSubjectKind(
                    (value as AuthoredReferenceTarget['routeSubjectKind']) ?? 'CREATURE'
                  )
                }
              />
              <TextInput
                classNames={{ input: styles.input }}
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
