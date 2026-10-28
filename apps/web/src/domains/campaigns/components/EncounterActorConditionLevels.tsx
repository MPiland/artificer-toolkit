import { ActionIcon, Group, Text } from '@mantine/core'
import { IconMinus, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getSystem } from '#app/data/systems/queries'
import type { EncounterGmActorDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterCommandPayload } from './encounterWorkspace.types'
import { heldConditionLevel, withConditionLevel } from './encounterConditionLevels.model'

/** The GM's level control for each leveled System condition (Exhaustion) a Creature can hold. */
export function EncounterActorConditionLevels({
  actor,
  disabled,
  gameSystemId,
  onCommand
}: {
  actor: EncounterGmActorDto
  disabled: boolean
  gameSystemId: string
  onCommand: (payload: EncounterCommandPayload) => void
}) {
  const leveledConditions = useQuery({
    ...getSystem(gameSystemId),
    select: (system) =>
      (system?.conditionTypes ?? []).flatMap(({ id, label, maximumLevel }) =>
        maximumLevel === undefined ? [] : [{ id, label, maximumLevel }]
      )
  }).data

  return leveledConditions?.map((condition) => {
    const level = heldConditionLevel(actor.conditions, condition.id)
    const setLevel = (next: number) =>
      onCommand({
        type: 'UPDATE_ACTOR',
        actorId: actor.id,
        conditions: withConditionLevel(actor.conditions, condition.id, next)
      })
    return (
      <Group key={condition.id} aria-label={`${condition.label} level`} gap='xs' role='group'>
        <Text size='sm'>{condition.label}</Text>
        <ActionIcon
          aria-label={`Decrease ${condition.label} level`}
          disabled={disabled || level <= 0}
          variant='default'
          onClick={() => setLevel(level - 1)}
        >
          <IconMinus aria-hidden size={16} />
        </ActionIcon>
        <Text aria-live='polite' size='sm'>{`Level ${level}`}</Text>
        <ActionIcon
          aria-label={`Increase ${condition.label} level`}
          disabled={disabled || level >= condition.maximumLevel}
          variant='default'
          onClick={() => setLevel(level + 1)}
        >
          <IconPlus aria-hidden size={16} />
        </ActionIcon>
      </Group>
    )
  })
}
