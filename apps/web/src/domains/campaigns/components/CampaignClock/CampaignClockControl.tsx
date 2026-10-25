import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import { getCampaignClock } from '#app/data/campaigns/queries'
import { CampaignClockEditor } from './CampaignClockEditor'
import { CampaignClockRecoveryPrompts } from './CampaignClockRecoveryPrompts'
import { clockDisplayTime, formatTime } from './campaignClockTime'
import * as styles from './CampaignClock.css'

export function CampaignClockControl({ campaign }: { campaign: CampaignDetailDto }) {
  const start = useConvexMutation(convexApi.campaigns.clock.start)
  const pause = useConvexMutation(convexApi.campaigns.clock.pause)
  const reconcileClock = useConvexMutation(convexApi.campaigns.clock.reconcile)
  const clock = useQuery(getCampaignClock(campaign.id))
  const [now, setNow] = useState(Date.now)
  const editable = campaign.capabilities.manageActiveCampaign
  const toggle = useMutation({
    mutationFn: () => {
      if (!clock.data) throw new Error('Set Campaign time first.')
      const input = {
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: clock.data.version
      }
      return clock.data.running ? pause(input) : start(input)
    }
  })
  const { mutate: reconcile, error: reconcileError } = useMutation({
    mutationFn: () => {
      if (!clock.data) throw new Error('Set Campaign time first.')
      return reconcileClock({
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: clock.data.version
      })
    }
  })
  useEffect(() => {
    if (!clock.data?.running) return
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (editable) reconcile()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [clock.data?.running, editable, reconcile])
  const display = clock.data ? clockDisplayTime(clock.data, now) : null

  return (
    <div className={styles.control} aria-label='World time'>
      <div className={styles.summary}>
        <Text c='dimmed' fw={700} size='xs'>
          World time
        </Text>
        <Group gap='xs' wrap='nowrap'>
          <Text fw={700} size='sm'>
            {display
              ? `Day ${display.day} · ${formatTime(display.minuteOfDay)}`
              : clock.isPending
                ? 'Loading…'
                : clock.error
                  ? 'Unavailable'
                  : 'Not set'}
          </Text>
          {clock.data ? (
            <Badge
              color={clock.data.running ? 'green' : clock.data.pausedForCombat ? 'yellow' : 'gray'}
              size='xs'
              variant='light'
            >
              {clock.data.running
                ? 'Running'
                : clock.data.pausedForCombat
                  ? 'Paused for combat'
                  : 'Paused'}
            </Badge>
          ) : null}
        </Group>
        {clock.data ? (
          <Text c='dimmed' size='xs'>
            Dawn {formatTime(clock.data.dawnMinute)} · Dusk {formatTime(clock.data.duskMinute)}
          </Text>
        ) : null}
        {editable ? <CampaignClockRecoveryPrompts campaignId={campaign.id} /> : null}
      </div>
      {toggle.error || reconcileError ? (
        <Text c='red' role='alert' size='xs'>
          World time could not be updated. Try again.
        </Text>
      ) : null}
      {editable ? (
        <Group gap={4} wrap='nowrap'>
          {clock.data ? (
            <Tooltip label={clock.data.running ? 'Pause world time' : 'Start world time'}>
              <ActionIcon
                aria-label={clock.data.running ? 'Pause world time' : 'Start world time'}
                loading={toggle.isPending}
                size='lg'
                variant='subtle'
                onClick={() => toggle.mutate()}
              >
                {clock.data.running ? (
                  <IconPlayerPause aria-hidden size={18} />
                ) : (
                  <IconPlayerPlay aria-hidden size={18} />
                )}
              </ActionIcon>
            </Tooltip>
          ) : null}
          <CampaignClockEditor key={campaign.id} campaign={campaign} clock={clock.data ?? null} />
        </Group>
      ) : null}
    </div>
  )
}
