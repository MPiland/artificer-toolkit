import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import { useRevealCampaignRollMutation } from '#app/data/rolls'

export function CharacterSheetRollReveal({ roll }: { roll: RollHistoryEntryDto }) {
  const reveal = useRevealCampaignRollMutation()
  const gmCampaignRoll = roll.gmCampaignRoll
  if (!gmCampaignRoll) return null
  if (gmCampaignRoll.revealedAt !== null)
    return (
      <Text c='dimmed' size='xs'>
        Revealed to table
      </Text>
    )
  return (
    <Button
      loading={reveal.isPending}
      size='compact-xs'
      variant='subtle'
      onClick={() =>
        reveal.mutate(
          { campaignId: gmCampaignRoll.campaignId, rollId: roll.id },
          {
            onError: (error) =>
              notifications.show({
                color: 'red',
                message: error instanceof Error ? error.message : 'The roll could not be revealed.'
              })
          }
        )
      }
    >
      Reveal to table
    </Button>
  )
}
