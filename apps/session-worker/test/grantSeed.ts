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
}): NonNullable<MovementRoomConfig['seed']> {
  return async ({ effects, encounterId, occurredAt }) => {
    const { ownedConditionId, ...grant } = input
    const planned = plannedModifierGrant({ encounterId, ...grant })
    if (ownedConditionId && planned.definition.schemaVersion !== 2)
      throw new Error('Only a version 2 effect can own a condition.')
    await effects.create({
      id: crypto.randomUUID(),
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: input.holderActorId },
      definition:
        ownedConditionId && planned.definition.schemaVersion === 2
          ? {
              ...planned.definition,
              stateContributions: [
                ...planned.definition.stateContributions,
                {
                  kind: 'CONDITION_OWNERSHIP',
                  conditionId: ownedConditionId,
                  baselinePresent: false
                }
              ]
            }
          : planned.definition,
      lifecycle: planned.lifecycle,
      occurredAt
    })
  }
}
