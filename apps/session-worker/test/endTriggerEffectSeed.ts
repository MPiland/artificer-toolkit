import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import {
  canonicalActiveEffectEndTriggers,
  type ActiveEffectEndTrigger
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { invisibility } from '@artificer-toolkit/source-data/srd/spells/invisibility.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { actionRoom } from './actionRoomFixture.js'

export const INVISIBLE_ID = SRD_CONDITION_TYPES.find(({ code }) => code === 'INVISIBLE')!.id

/**
 * Seeds Invisibility on `holderActorId`, cast by `sourceActorId`, ending on `triggers`: the
 * condition-owning effect a structured end trigger (SPELLS-27.T4, T4b) or a lifecycle end event
 * (SPELLS-31.T5n) ends and releases.
 */
export function endTriggerEffectSeed(input: {
  effectId: string
  holderActorId: string
  sourceActorId: string
  triggers?: readonly ActiveEffectEndTrigger[]
}): NonNullable<Parameters<typeof actionRoom>[0]['seed']> {
  return async ({ effects, encounterId, occurredAt }) => {
    const planned = plannedTimedCondition({
      encounterId,
      sourceActorId: input.sourceActorId,
      holderActorId: input.holderActorId,
      spell: invisibility,
      lifetimeScope: 'ENCOUNTER'
    })
    await effects.create({
      id: input.effectId,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: input.holderActorId },
      definition: {
        ...planned.definition,
        recurrence: {
          ...planned.definition.recurrence,
          endTriggers: canonicalActiveEffectEndTriggers(input.triggers ?? [])
        }
      },
      lifecycle: planned.lifecycle,
      occurredAt
    })
  }
}
