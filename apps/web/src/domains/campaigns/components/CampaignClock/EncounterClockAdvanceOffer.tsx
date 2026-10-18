import { Alert, Button, Group, Text } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { campaignMinutesForRounds } from '@artificer-toolkit/rules-runtime/campaignClock'
import { useMutation as useConvexMutation } from 'convex/react'
import { getCampaignClock } from '#app/data/campaigns/queries'

/** GM-only, right after COMPLETE: combat held the clock, so offer the Encounter's elapsed time. */
export function EncounterClockAdvanceOffer({
  campaignId,
  rounds,
  onClose
}: {
  campaignId: string
  rounds: number
  onClose: () => void
}) {
  const clock = useQuery(getCampaignClock(campaignId))
  const advanceClock = useConvexMutation(convexApi.campaigns.clock.advance)
  const minutes = campaignMinutesForRounds(rounds)
  const advance = useMutation({
    mutationFn: () => {
      if (!clock.data) throw new Error('Set Campaign time first.')
      return advanceClock({
        campaignId,
        commandId: crypto.randomUUID(),
        expectedVersion: clock.data.version,
        minutes
      })
    },
    onSuccess: onClose
  })
  if (!clock.data) return null
  const minuteLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`

  return (
    <Alert color='blue' title='Advance world time?'>
      <Text size='sm'>
        The Encounter lasted {rounds === 1 ? '1 round' : `${rounds} rounds`}. Advancing the Campaign
        clock by {minuteLabel} counts down carried effects.
      </Text>
      {advance.error ? (
        <Text c='red' size='sm'>
          The clock couldn’t be advanced. Try again.
        </Text>
      ) : null}
      <Group gap='xs' mt='xs'>
        <Button loading={advance.isPending} size='compact-sm' onClick={() => advance.mutate()}>
          Advance {minuteLabel}
        </Button>
        <Button size='compact-sm' variant='default' onClick={onClose}>
          Not now
        </Button>
      </Group>
    </Alert>
  )
}
