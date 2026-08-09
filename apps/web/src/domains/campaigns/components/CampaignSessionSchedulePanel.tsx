import {
  Alert,
  Badge,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignSessionRsvps } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import {
  browserTimeZone,
  fromSessionLocalDateTime,
  supportedSessionTimeZones,
  toSessionLocalDateTime
} from '../campaignSessionSchedule'
import * as styles from '../campaigns.css'

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
  const queryClient = useQueryClient()
  const rsvps = useQuery(getCampaignSessionRsvps(campaign.id, session.id))
  const [scheduledStartAt, setScheduledStartAt] = useState(() =>
    toSessionLocalDateTime(session.scheduledStartAt, session.timeZone)
  )
  const [scheduledEndAt, setScheduledEndAt] = useState(() =>
    toSessionLocalDateTime(session.scheduledEndAt, session.timeZone)
  )
  const [timeZone, setTimeZone] = useState(session.timeZone ?? browserTimeZone())
  const updateSchedule = useMutation({
    mutationFn: () => {
      const hasStart = scheduledStartAt.length > 0
      const hasEnd = scheduledEndAt.length > 0
      if (hasStart !== hasEnd) throw new Error('Add both a start and end, or leave both blank.')
      return api.campaigns.sessions.update({
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.sessions(campaign.id) })
    }
  })
  const setRsvp = useMutation({
    mutationFn: (response: 'YES' | 'NO' | 'MAYBE') =>
      api.campaigns.sessions.rsvps.set({
        campaignId: campaign.id,
        sessionId: session.id,
        response
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionRsvps(campaign.id, session.id)
      })
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

  const currentRsvp = rsvps.data?.find((entry) => entry.userId === currentUserId)?.response ?? ''
  const counts = {
    yes: rsvps.data?.filter((entry) => entry.response === 'YES').length ?? 0,
    maybe: rsvps.data?.filter((entry) => entry.response === 'MAYBE').length ?? 0,
    no: rsvps.data?.filter((entry) => entry.response === 'NO').length ?? 0
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
      <SimpleGrid className={styles.sessionScheduleGrid} cols={{ base: 1, sm: 3 }}>
        <TextInput
          classNames={{ input: styles.input }}
          disabled={session.status === 'FINISHED' || updateSchedule.isPending}
          label='Starts'
          type='datetime-local'
          value={scheduledStartAt}
          onBlur={commitSchedule}
          onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
        />
        <TextInput
          classNames={{ input: styles.input }}
          disabled={session.status === 'FINISHED' || updateSchedule.isPending}
          label='Ends'
          min={scheduledStartAt || undefined}
          type='datetime-local'
          value={scheduledEndAt}
          onBlur={commitSchedule}
          onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
        />
        <Select
          classNames={{ input: styles.input }}
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
    </Stack>
  )
}
