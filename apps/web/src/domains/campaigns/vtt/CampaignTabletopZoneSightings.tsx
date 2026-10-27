import { Button, Group, Stack, Text } from '@mantine/core'
import type { DismissZoneSightingInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'

/**
 * The Characters that may have noticed a concealed zone (MOVE-3.5): a quiet row per sighting the
 * GM can dismiss. Only the GM's session state carries sightings.
 */
export function CampaignTabletopZoneSightings({
  actors,
  disabled,
  sightings,
  zones,
  onDismiss
}: {
  actors: readonly { id: string; label: string }[]
  disabled: boolean
  sightings: EncounterSessionStateDto['pendingZoneSightings']
  zones: EncounterSessionStateDto['placedZones']
  onDismiss: (sighting: Pick<DismissZoneSightingInputDto, 'spatialEffectId' | 'actorId'>) => void
}) {
  if (sightings.length === 0) return null
  return (
    <Stack aria-label='Zone sightings' gap={4} role='group'>
      {sightings.map(({ spatialEffectId, actorId }) => {
        const actor = actors.find((entry) => entry.id === actorId)?.label ?? 'A Character'
        const zone = zones.find((entry) => entry.id === spatialEffectId)?.label ?? 'a hidden zone'
        return (
          <Group
            gap='xs'
            justify='space-between'
            key={`${spatialEffectId}:${actorId}`}
            wrap='nowrap'
          >
            <Text size='xs'>
              {actor} may have noticed {zone}
            </Text>
            <Button
              aria-label={`Dismiss ${actor}'s sighting of ${zone}`}
              disabled={disabled}
              size='compact-xs'
              variant='default'
              onClick={() => onDismiss({ spatialEffectId, actorId })}
            >
              Dismiss
            </Button>
          </Group>
        )
      })}
    </Stack>
  )
}
