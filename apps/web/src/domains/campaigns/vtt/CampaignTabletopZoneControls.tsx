import { useState } from 'react'
import { Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type {
  DestroyZoneLayerInputDto,
  DisarmZoneInputDto,
  RevealZoneInputDto
} from '@artificer-toolkit/schema/api/encounters'

/**
 * The GM's hand on each placed zone (MOVE-3.7): show a concealed zone to chosen Characters, or
 * disarm it; a layer of a layered zone is instead destroyed by what its component authors, the next
 * one first when its layers fall in order (D223). The disarm DC and the criteria are the GM's own
 * notes; players never receive them.
 */
export function CampaignTabletopZoneControls({
  actors,
  disabled,
  zones,
  onDestroyLayer,
  onDisarm,
  onReveal
}: {
  actors: readonly { id: string; label: string }[]
  disabled: boolean
  zones: EncounterSessionStateDto['placedZones']
  onDestroyLayer: (destroy: Pick<DestroyZoneLayerInputDto, 'spatialEffectId'>) => void
  onDisarm: (disarm: Pick<DisarmZoneInputDto, 'spatialEffectId'>) => void
  onReveal: (reveal: Pick<RevealZoneInputDto, 'spatialEffectId' | 'actorIds'>) => void
}) {
  const [chosen, setChosen] = useState<Readonly<Record<string, string[]>>>({})
  if (zones.length === 0) return null
  return (
    <Stack aria-label='Placed zones' gap={6} role='group'>
      {zones.map((zone) => {
        const name = zone.label ?? 'Unnamed zone'
        const actorIds = chosen[zone.id] ?? []
        return (
          <Stack gap={4} key={zone.id}>
            <Group gap='xs' justify='space-between' wrap='nowrap'>
              <Text size='xs'>
                {name}
                {zone.disarmDc ? ` · disarm DC ${zone.disarmDc.value}` : ''}
              </Text>
              {zone.destruction ? (
                <Button
                  aria-label={`Destroy ${name}`}
                  disabled={disabled || !zone.destruction.next}
                  size='compact-xs'
                  title={zone.destruction.next ? undefined : 'Destroy the layers before it first.'}
                  variant='default'
                  onClick={() => onDestroyLayer({ spatialEffectId: zone.id })}
                >
                  Destroy layer
                </Button>
              ) : (
                <Button
                  aria-label={`Disarm ${name}`}
                  disabled={disabled}
                  size='compact-xs'
                  variant='default'
                  onClick={() => onDisarm({ spatialEffectId: zone.id })}
                >
                  Disarm
                </Button>
              )}
            </Group>
            {zone.destruction ? (
              <Text c='dimmed' size='xs'>
                Destroyed by: {zone.destruction.criteria.join('; ')}
              </Text>
            ) : null}
            {zone.unawareActorIds.length > 0 ? (
              <Group align='end' gap='xs' wrap='nowrap'>
                <MultiSelect
                  aria-label={`Reveal ${name} to`}
                  data={actors
                    .filter(({ id }) => zone.unawareActorIds.includes(id))
                    .map(({ id, label }) => ({ label, value: id }))}
                  disabled={disabled}
                  placeholder='Reveal to…'
                  size='xs'
                  value={actorIds}
                  onChange={(next) => setChosen((current) => ({ ...current, [zone.id]: next }))}
                />
                <Button
                  aria-label={`Reveal ${name}`}
                  disabled={disabled || actorIds.length === 0}
                  size='compact-xs'
                  onClick={() => {
                    onReveal({ spatialEffectId: zone.id, actorIds })
                    setChosen((current) => ({ ...current, [zone.id]: [] }))
                  }}
                >
                  Reveal
                </Button>
              </Group>
            ) : null}
          </Stack>
        )
      })}
    </Stack>
  )
}
