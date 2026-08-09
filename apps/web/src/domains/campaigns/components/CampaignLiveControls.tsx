import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Popover,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { IconClockCog, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react'
import { getCampaignClock } from '#app/data/campaigns/queries'
import { api, type CampaignDetailDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from '../campaigns.css'

export function CampaignLiveControls({ campaign }: { campaign: CampaignDetailDto }) {
  const queryClient = useQueryClient()
  const clock = useQuery(getCampaignClock(campaign.id))
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('08:00')
  const [dawn, setDawn] = useState('06:00')
  const [dusk, setDusk] = useState('18:00')
  const [rewindMinutes, setRewindMinutes] = useState(10)
  const [rewindReason, setRewindReason] = useState('')
  const [setupOpened, setSetupOpened] = useState(false)
  const editable = campaign.role === 'OWNER' && campaign.status === 'ACTIVE'

  useEffect(() => {
    if (!clock.data) return
    setDay(clock.data.day)
    setTime(formatTime(clock.data.minuteOfDay))
    setDawn(formatTime(clock.data.dawnMinute))
    setDusk(formatTime(clock.data.duskMinute))
  }, [clock.data])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.clock(campaign.id) })
  }
  const sync = useMutation({
    mutationFn: () => {
      const current = clock.data
      const common = {
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: current?.version ?? 0,
        day,
        minuteOfDay: parseTime(time),
        dawnMinute: parseTime(dawn),
        duskMinute: parseTime(dusk)
      }
      return current
        ? api.campaigns.clock.configure(common)
        : api.campaigns.clock.initialize(common)
    },
    onSuccess: async () => {
      setSetupOpened(false)
      await refresh()
    }
  })
  const command = useMutation({
    mutationFn: (kind: 'START' | 'PAUSE' | 'ADVANCE' | 'REWIND') => {
      const current = clock.data
      if (!current) throw new Error('Synchronize Campaign time first.')
      const common = {
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: current.version
      }
      if (kind === 'START') return api.campaigns.clock.start(common)
      if (kind === 'PAUSE') return api.campaigns.clock.pause(common)
      if (kind === 'ADVANCE') return api.campaigns.clock.advance({ ...common, minutes: 60 })
      return api.campaigns.clock.rewind({
        ...common,
        minutes: rewindMinutes,
        correctionReason: rewindReason.trim()
      })
    },
    onSuccess: async () => {
      setRewindReason('')
      await refresh()
    }
  })

  useEffect(() => {
    if (!clock.data?.running || !editable) return
    const timer = window.setInterval(() => {
      void api.campaigns.clock
        .reconcile({
          campaignId: campaign.id,
          commandId: crypto.randomUUID(),
          expectedVersion: clock.data?.version ?? 0
        })
        .then(refresh)
        .catch(() => undefined)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [campaign.id, clock.data, editable, queryClient])

  const error = sync.error ?? command.error
  return (
    <div className={styles.clockControl} aria-label='World time'>
      <div className={styles.clockSummary}>
        <Text c='dimmed' fw={700} size='xs'>
          World time
        </Text>
        <Group gap='xs' wrap='nowrap'>
          <Text fw={700} size='sm'>
            {clock.data
              ? `Day ${clock.data.day} · ${formatTime(clock.data.minuteOfDay)}`
              : 'Not set'}
          </Text>
          {clock.data ? (
            <Badge color={clock.data.running ? 'green' : 'gray'} size='xs' variant='light'>
              {clock.data.running ? 'Running' : 'Paused'}
            </Badge>
          ) : null}
        </Group>
        {clock.data ? (
          <Text c='dimmed' size='xs'>
            Dawn {formatTime(clock.data.dawnMinute)} · Dusk {formatTime(clock.data.duskMinute)}
          </Text>
        ) : null}
      </div>
      {editable ? (
        <Group className={styles.clockActions} gap={4} wrap='nowrap'>
          {clock.data ? (
            <Tooltip label={clock.data.running ? 'Pause world time' : 'Start world time'}>
              <ActionIcon
                aria-label={clock.data.running ? 'Pause world time' : 'Start world time'}
                loading={command.isPending}
                size='lg'
                variant='subtle'
                onClick={() => command.mutate(clock.data?.running ? 'PAUSE' : 'START')}
              >
                {clock.data.running ? (
                  <IconPlayerPause aria-hidden size={18} />
                ) : (
                  <IconPlayerPlay aria-hidden size={18} />
                )}
              </ActionIcon>
            </Tooltip>
          ) : null}
          <Popover opened={setupOpened} position='bottom-end' onChange={setSetupOpened}>
            <Popover.Target>
              {clock.data ? (
                <Tooltip label='Adjust world time'>
                  <ActionIcon
                    aria-label='Adjust world time'
                    size='lg'
                    variant='subtle'
                    onClick={() => setSetupOpened((open) => !open)}
                  >
                    <IconClockCog aria-hidden size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Button
                  size='compact-sm'
                  variant='default'
                  onClick={() => setSetupOpened((open) => !open)}
                >
                  Set time
                </Button>
              )}
            </Popover.Target>
            <Popover.Dropdown>
              <Stack className={styles.clockSetupPopover} gap='sm'>
                <Text fw={700}>World time</Text>
                <div className={styles.clockSetupGrid}>
                  <NumberInput
                    classNames={{ input: styles.input }}
                    label='Day'
                    min={1}
                    value={day}
                    onChange={(value) => setDay(Number(value) || 1)}
                  />
                  <TextInput
                    classNames={{ input: styles.input }}
                    label='Time'
                    type='time'
                    value={time}
                    onChange={(event) => setTime(event.currentTarget.value)}
                  />
                  <TextInput
                    classNames={{ input: styles.input }}
                    label='Dawn'
                    type='time'
                    value={dawn}
                    onChange={(event) => setDawn(event.currentTarget.value)}
                  />
                  <TextInput
                    classNames={{ input: styles.input }}
                    label='Dusk'
                    type='time'
                    value={dusk}
                    onChange={(event) => setDusk(event.currentTarget.value)}
                  />
                </div>
                <Button loading={sync.isPending} onClick={() => sync.mutate()}>
                  Save time
                </Button>
                {clock.data ? (
                  <>
                    <Text fw={700} size='sm'>
                      Correct the clock
                    </Text>
                    <NumberInput
                      classNames={{ input: styles.input }}
                      label='Rewind minutes'
                      min={1}
                      value={rewindMinutes}
                      onChange={(value) => setRewindMinutes(Number(value) || 1)}
                    />
                    <TextInput
                      classNames={{ input: styles.input }}
                      label='Correction reason'
                      value={rewindReason}
                      onChange={(event) => setRewindReason(event.currentTarget.value)}
                    />
                    <Group>
                      <Button
                        disabled={!rewindReason.trim()}
                        loading={command.isPending}
                        variant='default'
                        onClick={() => command.mutate('REWIND')}
                      >
                        Rewind
                      </Button>
                      <Button variant='default' onClick={() => command.mutate('ADVANCE')}>
                        +1 hour
                      </Button>
                    </Group>
                  </>
                ) : null}
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      ) : null}
      {error ? (
        <Alert className={styles.clockError} color='red'>
          {error.message}
        </Alert>
      ) : null}
    </div>
  )
}

function parseTime(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function formatTime(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60)
    .toString()
    .padStart(2, '0')
  const minutes = (minuteOfDay % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
