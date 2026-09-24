import {
  Alert,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useEffect, useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { useConvex, usePaginatedQuery } from 'convex/react'
import {
  browserTimeZone,
  fromSessionLocalDateTime,
  supportedSessionTimeZones,
  toSessionLocalDateTime
} from '../campaignSessionSchedule'
import * as sharedStyles from '../campaigns.css'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionSchedulePanel({
  campaign,
  currentUserId,
  session,
  onUpdated
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
  onUpdated: (session: CampaignSessionDto) => void
}) {
  const convex = useConvex()
  const rsvps = usePaginatedQuery(
    convexApi.campaigns.sessionRsvps.list,
    campaign.role === 'OWNER' ? { campaignId: campaign.id, sessionId: session.id } : 'skip',
    { initialNumItems: 32 }
  )
  const [scheduledStartAt, setScheduledStartAt] = useState(() =>
    toSessionLocalDateTime(session.scheduledStartAt, session.timeZone)
  )
  const [scheduledEndAt, setScheduledEndAt] = useState(() =>
    toSessionLocalDateTime(session.scheduledEndAt, session.timeZone)
  )
  const [timeZone, setTimeZone] = useState(session.timeZone ?? browserTimeZone())
  const [submittedRsvp, setSubmittedRsvp] = useState<'YES' | 'NO' | 'MAYBE' | null>(null)
  const updateSchedule = useMutation({
    mutationFn: () => {
      const hasStart = scheduledStartAt.length > 0
      const hasEnd = scheduledEndAt.length > 0
      if (hasStart !== hasEnd) throw new Error('Add both a start and end, or leave both blank.')
      return convex.mutation(convexApi.campaigns.sessions.update, {
        campaignId: campaign.id,
        sessionId: session.id,
        expectedVersion: session.version,
        scheduledStartAt: hasStart ? fromSessionLocalDateTime(scheduledStartAt, timeZone) : null,
        scheduledEndAt: hasEnd ? fromSessionLocalDateTime(scheduledEndAt, timeZone) : null,
        timeZone: hasStart && hasEnd ? timeZone : null
      })
    },
    onSuccess: (updated) => {
      onUpdated(updated)
    }
  })
  const setRsvp = useMutation({
    mutationFn: (response: 'YES' | 'NO' | 'MAYBE') =>
      convex.mutation(convexApi.campaigns.sessionRsvps.set, {
        campaignId: campaign.id,
        sessionId: session.id,
        response
      }),
    onSuccess: (rsvp) => setSubmittedRsvp(rsvp.response)
  })

  useEffect(() => {
    setScheduledStartAt(toSessionLocalDateTime(session.scheduledStartAt, session.timeZone))
    setScheduledEndAt(toSessionLocalDateTime(session.scheduledEndAt, session.timeZone))
    setTimeZone(session.timeZone ?? browserTimeZone())
  }, [session.scheduledEndAt, session.scheduledStartAt, session.timeZone])

  function commitSchedule() {
    const currentStart = toSessionLocalDateTime(session.scheduledStartAt, session.timeZone)
    const currentEnd = toSessionLocalDateTime(session.scheduledEndAt, session.timeZone)
    if (
      scheduledStartAt === currentStart &&
      scheduledEndAt === currentEnd &&
      timeZone === (session.timeZone ?? browserTimeZone())
    ) {
      return
    }
    if (scheduledStartAt.length > 0 !== scheduledEndAt.length > 0) return
    updateSchedule.mutate()
  }

  const currentRsvp =
    rsvps.results.find((entry) => entry.userId === currentUserId)?.response ?? submittedRsvp ?? ''
  const counts = {
    yes: rsvps.results.filter((entry) => entry.response === 'YES').length,
    maybe: rsvps.results.filter((entry) => entry.response === 'MAYBE').length,
    no: rsvps.results.filter((entry) => entry.response === 'NO').length
  }
  const incomplete = scheduledStartAt.length > 0 !== scheduledEndAt.length > 0

  return (
    <Stack gap='md'>
      <Group align='flex-start' justify='space-between' wrap='wrap'>
        <div>
          <Text fw={700}>Schedule & RSVP</Text>
          <Text c='dimmed' size='sm'>
            Scheduling is optional. Attendance is recorded separately during play.
          </Text>
        </div>
        <Group gap='xs'>
          <Badge color='green' variant='light'>
            {counts.yes} yes
          </Badge>
          <Badge color='yellow' variant='light'>
            {counts.maybe} maybe
          </Badge>
          <Badge color='gray' variant='light'>
            {counts.no} no
          </Badge>
        </Group>
      </Group>
      <SimpleGrid className={sessionsStyles.sessionScheduleGrid} cols={{ base: 1, sm: 3 }}>
        <TextInput
          classNames={{ input: sharedStyles.input }}
          disabled={session.status === 'FINISHED' || updateSchedule.isPending}
          label='Starts'
          type='datetime-local'
          value={scheduledStartAt}
          onBlur={commitSchedule}
          onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
        />
        <TextInput
          classNames={{ input: sharedStyles.input }}
          disabled={session.status === 'FINISHED' || updateSchedule.isPending}
          label='Ends'
          min={scheduledStartAt || undefined}
          type='datetime-local'
          value={scheduledEndAt}
          onBlur={commitSchedule}
          onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
        />
        <Select
          classNames={{ input: sharedStyles.input }}
          data={supportedSessionTimeZones()}
          disabled={
            session.status === 'FINISHED' ||
            updateSchedule.isPending ||
            (!scheduledStartAt && !scheduledEndAt)
          }
          label='Time zone'
          searchable
          value={timeZone}
          onBlur={commitSchedule}
          onChange={(value) => value && setTimeZone(value)}
        />
      </SimpleGrid>
      {incomplete ? (
        <Alert color='orange'>Add both a start and end, or leave both blank.</Alert>
      ) : updateSchedule.error ? (
        <Alert color='red'>{updateSchedule.error.message}</Alert>
      ) : null}
      {session.status === 'OPEN' ? (
        <Group align='center' justify='space-between' wrap='wrap'>
          <Text fw={600} size='sm'>
            Your RSVP
          </Text>
          <SegmentedControl
            aria-label='Your RSVP'
            data={[
              { label: 'Yes', value: 'YES' },
              { label: 'Maybe', value: 'MAYBE' },
              { label: 'No', value: 'NO' }
            ]}
            disabled={setRsvp.isPending}
            value={currentRsvp}
            onChange={(value) => {
              if (value === 'YES' || value === 'NO' || value === 'MAYBE') setRsvp.mutate(value)
            }}
          />
        </Group>
      ) : null}
      {setRsvp.error ? <Alert color='red'>Your RSVP couldn’t be updated.</Alert> : null}
      {rsvps.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => rsvps.loadMore(32)}>
          Load more RSVPs
        </Button>
      ) : null}
    </Stack>
  )
}
