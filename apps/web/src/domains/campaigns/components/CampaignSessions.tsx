import {
  Alert,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useNavigate } from '@tanstack/react-router'
import { IconChevronRight } from '@tabler/icons-react'
import { type SubmitEvent, useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { useConvex, usePaginatedQuery } from 'convex/react'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import {
  browserTimeZone,
  fromSessionLocalDateTime,
  supportedSessionTimeZones
} from '../campaignSessionSchedule'
import * as sharedStyles from '../campaigns.css'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessions({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const convex = useConvex()
  const navigate = useNavigate()
  const sessions = usePaginatedQuery(
    convexApi.campaigns.sessions.list,
    { campaignId: campaign.id },
    { initialNumItems: 8 }
  )
  const [editorOpen, setEditorOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledStartAt, setScheduledStartAt] = useState('')
  const [scheduledEndAt, setScheduledEndAt] = useState('')
  const [timeZone, setTimeZone] = useState(browserTimeZone)

  const create = useMutation({
    mutationFn: () =>
      convex.mutation(convexApi.campaigns.sessions.create, {
        campaignId: campaign.id,
        title: title.trim() || null,
        scheduledStartAt:
          scheduledStartAt && scheduledEndAt
            ? fromSessionLocalDateTime(scheduledStartAt, timeZone)
            : null,
        scheduledEndAt:
          scheduledStartAt && scheduledEndAt
            ? fromSessionLocalDateTime(scheduledEndAt, timeZone)
            : null,
        timeZone: scheduledStartAt && scheduledEndAt ? timeZone : null
      }),
    onSuccess: async () => {
      setEditorOpen(false)
      setTitle('')
      setScheduledStartAt('')
      setScheduledEndAt('')
    }
  })
  const editable = campaign.capabilities.manageActiveCampaign
  const scheduleIncomplete = Boolean(scheduledStartAt) !== Boolean(scheduledEndAt)

  return (
    <section className={sessionsStyles.sessionsPanel} aria-labelledby='campaign-sessions-title'>
      <Group align='flex-start' justify='space-between' wrap='wrap'>
        <div>
          <Title order={2} id='campaign-sessions-title'>
            Sessions
          </Title>
          <Text c='dimmed' size='sm'>
            {campaign.role === 'OWNER'
              ? 'Plan upcoming Sessions and revisit the table’s history.'
              : 'Review upcoming Sessions, RSVP, and revisit the table’s history.'}
          </Text>
        </div>
        {editable && !editorOpen ? (
          <Button onClick={() => setEditorOpen(true)}>Add session</Button>
        ) : null}
      </Group>

      {editorOpen ? (
        <form
          className={sessionsStyles.sessionEditor}
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <Title order={3}>New session</Title>
          <TextInput
            classNames={{ input: sharedStyles.input }}
            label='Name (optional)'
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
          <TextInput
            classNames={{ input: sharedStyles.input }}
            label='Starts (optional)'
            type='datetime-local'
            value={scheduledStartAt}
            onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
          />
          <TextInput
            classNames={{ input: sharedStyles.input }}
            label='Ends'
            min={scheduledStartAt || undefined}
            type='datetime-local'
            value={scheduledEndAt}
            onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
          />
          <Select
            classNames={{ input: sharedStyles.input }}
            data={supportedSessionTimeZones()}
            disabled={!scheduledStartAt && !scheduledEndAt}
            label='Time zone'
            searchable
            value={timeZone}
            onChange={(value) => value && setTimeZone(value)}
          />
          {create.error ? (
            <Alert color='red'>The Session couldn’t be created. Your entries are still here.</Alert>
          ) : null}
          {scheduleIncomplete ? (
            <Alert color='orange'>Add both a start and end, or leave both blank.</Alert>
          ) : null}
          <Group>
            <Button disabled={scheduleIncomplete} loading={create.isPending} type='submit'>
              Save session
            </Button>
            <Button variant='subtle' onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
          </Group>
        </form>
      ) : null}

      {sessions.status === 'LoadingFirstPage' ? <Text c='dimmed'>Loading sessions…</Text> : null}
      {sessions.status === 'Exhausted' && sessions.results.length === 0 ? (
        <div className={sharedStyles.emptyState}>
          <Text fw={600}>No sessions yet.</Text>
          <Text c='dimmed' size='sm'>
            {campaign.role === 'OWNER'
              ? 'Add the first session when you are ready to plan the table.'
              : 'The GM has not added a Session yet.'}
          </Text>
        </div>
      ) : null}
      <Stack className={sessionsStyles.sessionList} gap={0}>
        {sessions.results.map((session) => (
          <SessionRow
            campaign={campaign}
            currentUserId={currentUserId}
            key={session.id}
            session={session}
            onOpen={() =>
              navigate({
                to: '/campaigns/$campaignPublicId/$campaignSlug/sessions/$sessionNumber',
                params: {
                  ...buildCampaignRouteParams(campaign.publicId, campaign.name),
                  sessionNumber: String(session.sessionNumber)
                }
              })
            }
          />
        ))}
      </Stack>
      {sessions.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => sessions.loadMore(8)}>
          Load more sessions
        </Button>
      ) : null}
    </section>
  )
}

function SessionRow({
  campaign,
  currentUserId,
  session,
  onOpen
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
  onOpen: () => void
}) {
  const convex = useConvex()
  const rsvps = usePaginatedQuery(
    convexApi.campaigns.sessionRsvps.list,
    campaign.role === 'OWNER' && session.status === 'OPEN'
      ? { campaignId: campaign.id, sessionId: session.id }
      : 'skip',
    { initialNumItems: 32 }
  )
  const [submittedRsvp, setSubmittedRsvp] = useState<'YES' | 'NO' | 'MAYBE' | null>(null)
  const setRsvp = useMutation({
    mutationFn: (response: 'YES' | 'NO' | 'MAYBE') =>
      convex.mutation(convexApi.campaigns.sessionRsvps.set, {
        campaignId: campaign.id,
        sessionId: session.id,
        response
      }),
    onSuccess: (rsvp) => setSubmittedRsvp(rsvp.response)
  })
  const currentRsvp =
    rsvps.results.find((entry) => entry.userId === currentUserId)?.response ?? submittedRsvp
  const identity = (
    <div>
      <Group gap='xs'>
        <Text fw={700}>{sessionLabel(session)}</Text>
        <SessionStatus status={session.status} />
      </Group>
      <Text c='dimmed' size='sm'>
        {formatSessionSchedule(session)}
      </Text>
    </div>
  )
  return (
    <div className={sessionsStyles.sessionRow}>
      <UnstyledButton
        aria-label={`Open ${sessionLabel(session)}`}
        className={sessionsStyles.sessionRowMain}
        onClick={onOpen}
      >
        {identity}
        <IconChevronRight aria-hidden className={sessionsStyles.sessionOpenCue} size={18} />
      </UnstyledButton>
      {session.status === 'OPEN' && campaign.role === 'PLAYER' ? (
        <SegmentedControl
          aria-label={`RSVP for ${sessionLabel(session)}`}
          data={[
            { label: 'Yes', value: 'YES' },
            { label: 'Maybe', value: 'MAYBE' },
            { label: 'No', value: 'NO' }
          ]}
          disabled={setRsvp.isPending}
          size='xs'
          value={currentRsvp ?? ''}
          onChange={(value) => {
            if (value === 'YES' || value === 'NO' || value === 'MAYBE') setRsvp.mutate(value)
          }}
        />
      ) : null}
      {setRsvp.error ? (
        <Text c='red' size='xs'>
          RSVP couldn’t be updated. Try again.
        </Text>
      ) : null}
    </div>
  )
}

function SessionStatus({ status }: { status: CampaignSessionDto['status'] }) {
  return <Badge variant='light'>{status === 'OPEN' ? 'Open' : 'Finished'}</Badge>
}

function sessionLabel(session: CampaignSessionDto) {
  if (session.title) return session.title
  if (session.scheduledStartAt)
    return `Session ${formatDate(session.scheduledStartAt, session.timeZone)}`
  return `Session ${session.sessionNumber}`
}

function formatSessionSchedule(session: CampaignSessionDto) {
  if (!session.scheduledStartAt || !session.scheduledEndAt || !session.timeZone) {
    return 'Not scheduled'
  }
  const day = formatDate(session.scheduledStartAt, session.timeZone)
  const start = formatTime(session.scheduledStartAt, session.timeZone)
  const end = formatTime(session.scheduledEndAt, session.timeZone)
  return `${day} · ${start}–${end} · ${session.timeZone}`
}

function formatDate(value: string, timeZone: string | null) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(value))
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).format(new Date(value))
}
