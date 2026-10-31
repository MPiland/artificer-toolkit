import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { canonicalActiveEffectEndTriggers } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'

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
  /** The d20 path a result-gated grant holds on (a failed save's grant), as its planner reads it. */
  resultPath?: 'ON_HIT' | 'ON_CRIT' | 'ON_SAVE_FAIL'
  /** The slot level a spell's grant was cast at, for a grant that scales by it (Branding Smite). */
  spellCastLevel?: number
  /** The maintained (Concentration) state the effect depends on, held by `sourceActorId`. */
  maintainedEffectStateId?: string
  /** The effect's own id, for another effect to link to. */
  id?: string
  /** The effect this one depends on: it ends with it. */
  linkedEffectId?: string
}): NonNullable<MovementRoomConfig['seed']> {
  return async ({ effects, encounterId, occurredAt }) => {
    const { ownedConditionId, endsOnCast, maintainedEffectStateId, id, linkedEffectId, ...grant } =
      input
    const planned = plannedModifierGrant({ encounterId, ...grant })
    const { definition } = planned
    await effects.create({
      id: id ?? crypto.randomUUID(),
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: input.holderActorId },
      definition: {
        ...definition,
        ...(linkedEffectId && { linkedEffectId }),
        recurrence: endsOnCast
          ? {
              ...definition.recurrence,
              endTriggers: canonicalActiveEffectEndTriggers([
                ...definition.recurrence.endTriggers,
                { event: 'LIFECYCLE', timing: 'END', code: 'ON_CAST_SPELL' } as const
              ])
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
      },
      lifecycle: planned.lifecycle,
      maintainedEffectStateId,
      occurredAt
    })
  }
}

/** A held-die effect: the real Guidance grant, authored to be offered after the d20 is seen. */
export function heldDieEffect(change: { count?: number; ability?: 'WISDOM' | 'STRENGTH' } = {}) {
  const effect = structuredClone(guidance.effects![0]!)
  for (const path of effect.paths)
    if (path.selectionKind === 'FIXED')
      for (const outcome of path.resultBlock.outcomes)
        if (outcome.effectKind === 'APPLY_GRANT')
          for (const modifier of outcome.grants.modifiers ?? []) {
            if (modifier.modifierKind !== 'ADD_BONUS_DIE') continue
            modifier.payload = {
              ...modifier.payload,
              ...(change.count === undefined ? {} : { count: change.count }),
              timing: 'AFTER_ROLL'
            }
            if (change.ability) modifier.domain = { ability: change.ability }
          }
  return effect
}

/** A held saving-throw die: the real Resistance grant, authored to be offered after the d20 is seen. */
export function heldSaveDieEffect(change: { count?: number } = {}) {
  const effect = structuredClone(resistance.effects![0]!)
  for (const path of effect.paths)
    if (path.selectionKind === 'FIXED')
      for (const outcome of path.resultBlock.outcomes)
        if (outcome.effectKind === 'APPLY_GRANT')
          for (const modifier of outcome.grants.modifiers ?? []) {
            if (modifier.modifierKind !== 'ADD_BONUS_DIE') continue
            modifier.payload = {
              ...modifier.payload,
              ...(change.count === undefined ? {} : { count: change.count }),
              timing: 'AFTER_ROLL'
            }
          }
  return effect
}
