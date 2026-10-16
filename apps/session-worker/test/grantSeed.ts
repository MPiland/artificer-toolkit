import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'

import type { MovementRoomConfig } from './movementRoomFixture.js'

/**
 * Seeds the real planned grant of `effect` (the SRD Antitoxin's by default), carrying `lifecycle`,
 * onto an Encounter actor; a Character actor's grant becomes a row of its Character.
 */
export function seedModifierGrant(input: {
  sourceActorId: string
  holderActorId: string
  lifecycle: PathLifecycleAuthored
  effect?: EffectAuthored
  sourceLabel?: string
  /** A condition the effect also owns on its holder, as Invisibility owns INVISIBLE. */
  ownedConditionId?: string
  /** The effect also ends on its holder's spell cast, as Invisibility does; a timed grant cannot author it. */
  endsOnCast?: true
}): NonNullable<MovementRoomConfig['seed']> {
  return async ({ effects, encounterId, occurredAt }) => {
    const { ownedConditionId, endsOnCast, ...grant } = input
    const planned = plannedModifierGrant({ encounterId, ...grant })
    const { definition } = planned
    if ((ownedConditionId || endsOnCast) && definition.schemaVersion !== 2)
      throw new Error('Only a version 2 effect can own a condition or end on a cast.')
    await effects.create({
      id: crypto.randomUUID(),
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: input.holderActorId },
      definition:
        definition.schemaVersion === 2
          ? {
              ...definition,
              recurrence: endsOnCast
                ? {
                    ...definition.recurrence,
                    endOnEvents: [
                      ...new Set([...definition.recurrence.endOnEvents, 'ON_CAST_SPELL' as const])
                    ].sort()
                  }
                : definition.recurrence,
              stateContributions: ownedConditionId
                ? [
                    ...definition.stateContributions,
                    {
                      kind: 'CONDITION_OWNERSHIP',
                      conditionId: ownedConditionId,
                      baselinePresent: false
                    }
                  ]
                : definition.stateContributions
            }
          : definition,
      lifecycle: planned.lifecycle,
      occurredAt
    })
  }
}
