import { Button, Group, Stack, Text } from '@mantine/core'
import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import type { EncounterConsequenceRollOfferDto } from '@artificer-toolkit/schema/shared/consequenceRolls'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { consequenceRollTriggerText } from './CampaignTabletopConsequenceRolls.model'

/**
 * The consequence table rolls a Character's damage or death saves offered the GM (ATTACK-15): roll
 * on the table, or decline. Only the GM's projection carries offers.
 */
export function CampaignTabletopConsequenceRolls({
  actor,
  disabled,
  onResolve
}: {
  actor: {
    label: string
    consequenceRollOffers: readonly EncounterConsequenceRollOfferDto[]
  }
  disabled: boolean
  onResolve: (resolution: {
    offer: EncounterConsequenceRollOfferDto
    decision: 'ACCEPT' | 'DECLINE'
    visibility: RollVisibilityDto
  }) => void
}) {
  const { gmRollVisibility } = useGmRollVisibilityPreference()
  if (actor.consequenceRollOffers.length === 0) return null
  return (
    <Stack aria-label={`Table rolls for ${actor.label}`} gap={4} role='group'>
      {actor.consequenceRollOffers.map((offer) => (
        <Stack gap={2} key={`${offer.sourceCommandId}:${offer.definitionId}`}>
          <Text size='xs'>
            {offer.label}: {actor.label} {offer.triggers.map(consequenceRollTriggerText).join(', ')}
          </Text>
          <Group gap={4}>
            {(['ACCEPT', 'DECLINE'] as const).map((decision) => (
              <Button
                aria-label={`${decision === 'ACCEPT' ? 'Roll' : 'Decline'} ${offer.label} for ${actor.label}`}
                disabled={disabled}
                key={decision}
                size='compact-xs'
                variant={decision === 'ACCEPT' ? 'filled' : 'default'}
                onClick={() => onResolve({ offer, decision, visibility: gmRollVisibility })}
              >
                {decision === 'ACCEPT' ? 'Roll' : 'Decline'}
              </Button>
            ))}
          </Group>
        </Stack>
      ))}
    </Stack>
  )
}
