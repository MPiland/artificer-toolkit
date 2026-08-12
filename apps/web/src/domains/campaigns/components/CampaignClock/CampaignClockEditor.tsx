import {
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Popover,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { CampaignClockDto, CampaignDetailDto } from '@artificer-toolkit/schema/api/campaigns'
import { api } from '#app/lib/api'
import * as styles from './CampaignClock.css'

export function CampaignClockEditor({
  campaign,
  clock,
  onUpdated
}: {
  campaign: CampaignDetailDto
  clock: CampaignClockDto | null
  onUpdated: () => Promise<void>
}) {
  const [opened, setOpened] = useState(false)
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('08:00')
  const [dawn, setDawn] = useState('06:00')
  const [dusk, setDusk] = useState('18:00')
  const [advanceMinutes, setAdvanceMinutes] = useState(60)
  const [rewindMinutes, setRewindMinutes] = useState(10)
  const [rewindReason, setRewindReason] = useState('')
  const [resetReason, setResetReason] = useState('')
  useEffect(() => {
    if (!clock) return
    setDay(clock.day)
    setTime(formatTime(clock.minuteOfDay))
    setDawn(formatTime(clock.dawnMinute))
    setDusk(formatTime(clock.duskMinute))
  }, [clock])

  const mutation = useMutation({
    mutationFn: async (kind: 'SAVE' | 'ADVANCE' | 'REWIND' | 'RESET') => {
      const common = {
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: clock?.version ?? 0
      }
      if (!clock)
        return api.campaigns.clock.initialize({
          ...common,
          day,
          minuteOfDay: parseTime(time),
          dawnMinute: parseTime(dawn),
          duskMinute: parseTime(dusk)
        })
      if (kind === 'SAVE')
        return api.campaigns.clock.configure({
          ...common,
          dawnMinute: parseTime(dawn),
          duskMinute: parseTime(dusk)
        })
      if (kind === 'ADVANCE')
        return api.campaigns.clock.advance({
          ...common,
          minutes: advanceMinutes
        })
      if (kind === 'REWIND')
        return api.campaigns.clock.rewind({
          ...common,
          minutes: rewindMinutes,
          correctionReason: rewindReason.trim()
        })
      return api.campaigns.clock.reset({
        ...common,
        day,
        minuteOfDay: parseTime(time),
        correctionReason: resetReason.trim()
      })
    },
    onSuccess: async () => {
      setRewindReason('')
      setResetReason('')
      await onUpdated()
    }
  })

  return (
    <Popover opened={opened} position='bottom-end' onChange={setOpened}>
      <Popover.Target>
        <Button size='compact-sm' variant='default' onClick={() => setOpened((value) => !value)}>
          {clock ? 'Adjust' : 'Set time'}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack className={styles.popover} gap='sm'>
          <Text fw={700}>World time</Text>
          <div className={styles.grid}>
            <NumberInput
              disabled={Boolean(clock)}
              label='Day'
              min={1}
              value={day}
              onChange={(value) => setDay(Number(value) || 1)}
            />
            <TextInput
              disabled={Boolean(clock)}
              label='Time'
              type='time'
              value={time}
              onChange={(event) => setTime(event.currentTarget.value)}
            />
            <TextInput
              label='Dawn'
              type='time'
              value={dawn}
              onChange={(event) => setDawn(event.currentTarget.value)}
            />
            <TextInput
              label='Dusk'
              type='time'
              value={dusk}
              onChange={(event) => setDusk(event.currentTarget.value)}
            />
          </div>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate('SAVE')}>
            {clock ? 'Save dawn and dusk' : 'Set Campaign time'}
          </Button>
          {clock ? (
            <>
              <Divider />
              <NumberInput
                label='Advance minutes'
                min={1}
                value={advanceMinutes}
                onChange={(value) => setAdvanceMinutes(Number(value) || 1)}
              />
              <Button variant='default' onClick={() => mutation.mutate('ADVANCE')}>
                Advance
              </Button>
              <Divider />
              <NumberInput
                label='Rewind minutes'
                min={1}
                value={rewindMinutes}
                onChange={(value) => setRewindMinutes(Number(value) || 1)}
              />
              <TextInput
                label='Correction reason'
                value={rewindReason}
                onChange={(event) => setRewindReason(event.currentTarget.value)}
              />
              <Button
                disabled={!hasCorrectionReason(rewindReason)}
                variant='default'
                onClick={() => mutation.mutate('REWIND')}
              >
                Rewind
              </Button>
              <Divider />
              <div className={styles.grid}>
                <NumberInput
                  label='Reset day'
                  min={1}
                  value={day}
                  onChange={(value) => setDay(Number(value) || 1)}
                />
                <TextInput
                  label='Reset time'
                  type='time'
                  value={time}
                  onChange={(event) => setTime(event.currentTarget.value)}
                />
              </div>
              <TextInput
                label='Reset reason'
                value={resetReason}
                onChange={(event) => setResetReason(event.currentTarget.value)}
              />
              <Group>
                <Button
                  color='red'
                  disabled={!hasCorrectionReason(resetReason)}
                  variant='outline'
                  onClick={() => mutation.mutate('RESET')}
                >
                  Reset clock
                </Button>
              </Group>
            </>
          ) : null}
          {mutation.error ? <Alert color='red'>{mutation.error.message}</Alert> : null}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function parseTime(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}
export function formatTime(minuteOfDay: number) {
  return `${Math.floor(minuteOfDay / 60)
    .toString()
    .padStart(2, '0')}:${(minuteOfDay % 60).toString().padStart(2, '0')}`
}
export function hasCorrectionReason(value: string) {
  return value.trim().length > 0
}
