import { useState } from 'react'

import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

/**
 * The cost the caster pays on this cast and the creatures it names, scoped to the selected action:
 * a different action starts from no cost. `choice` is what the resolve command carries. The
 * creatures of a modifier that adds targets (`extraTargetIds`) join the command's target list
 * instead, so `choice` leaves them out.
 */
export function useCastModifierChoice(action: EncounterActionChoiceDto | null) {
  const actionId = action?.id ?? null
  const [picked, setPicked] = useState<{
    actionId: string | null
    modifierId: string | null
    actorIds: string[]
  }>({ actionId, modifierId: null, actorIds: [] })
  const current = picked.actionId === actionId ? picked : null
  const modifierId = current?.modifierId ?? null
  const actorIds = current?.actorIds ?? []
  const modifier = action?.castModifiers?.find(({ id }) => id === modifierId)
  const addsTargets = modifier?.targets?.outcome === 'EXTRA_TARGET'
  return {
    modifiers: action?.castModifiers ?? [],
    modifier,
    actorIds,
    extraTargetIds: addsTargets ? actorIds.slice(0, modifier?.targets?.max) : [],
    pickModifier: (next: string | null) => setPicked({ actionId, modifierId: next, actorIds: [] }),
    pickActors: (next: string[]) => setPicked({ actionId, modifierId, actorIds: next }),
    choice: modifier
      ? {
          castModifierId: modifier.id,
          ...(modifier.targets && !addsTargets && actorIds.length
            ? { castModifierActorIds: actorIds.slice(0, modifier.targets.max) }
            : {})
        }
      : {}
  }
}

export type CastModifierChoice = ReturnType<typeof useCastModifierChoice>
