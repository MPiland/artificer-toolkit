import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react'
import { useEffect } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignClock } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { CampaignClockEditor, formatTime } from './CampaignClockEditor'
import * as styles from './CampaignClock.css'

export function CampaignClockControl({ campaign }: { campaign: CampaignDetailDto }) {
  const queryClient = useQueryClient()
  const clock = useQuery(getCampaignClock(campaign.id))
  const editable = campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.campaigns.clock(campaign.id)
    })
  }
  const toggle = useMutation({
    mutationFn: () => {
      if (!clock.data) throw new Error('Set Campaign time first.')
      const input = {
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        expectedVersion: clock.data.version
      }
      return clock.data.running
        ? api.campaigns.clock.pause(input)
        : api.campaigns.clock.start(input)
    },
    onSuccess: refresh
  })
  useEffect(() => {
    if (!clock.data?.running || !editable) return
    const timer = window.setInterval(() => {
      void api.campaigns.clock
        .reconcile({
          campaignId: campaign.id,
          commandId: crypto.randomUUID(),
          expectedVersion: clock.data!.version
        })
        .then(refresh)
        .catch(() => undefined)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [campaign.id, clock.data, editable])

  return (
    <div className={styles.control} aria-label='World time'>
      <div className={styles.summary}>
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
          <CampaignClockEditor campaign={campaign} clock={clock.data ?? null} onUpdated={refresh} />
        </Group>
      ) : null}
    </div>
  )
}
