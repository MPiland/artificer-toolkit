import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import type { CharacterRuleActionForcedMovementCollision } from './characterRuleActionSystemAdapter.js'
import type { EncounterBasicActionCapabilityDescriptor } from './encounterBasicActionCapabilityDiscovery.js'
import { bindEncounterEffect } from './encounterFeatureActionCapabilityDiscovery.js'

const COLLISION_FEET_PER_DIE_GROUP = 10
const DICE_TERM = /^([1-9]\d?)d([1-9]\d{0,2})$/

/**
 * The damage a mover takes for a collision (D159): the authored dice for every full 10 feet it
 * travelled. Null when it travelled under 10 feet, which deals none.
 */
export function collisionDamageDiceConfig(diceConfig: string, feetTravelled: number) {
  const groups = Math.floor(feetTravelled / COLLISION_FEET_PER_DIE_GROUP)
  const term = DICE_TERM.exec(diceConfig)
  if (!term) throw new Error('A forced-movement collision damages with a single dice term.')
  return groups > 0 ? `${Number(term[1]) * groups}d${term[2]}` : null
}

/**
 * The action a mover's collision damage runs as: an unsaved, untested damage outcome of one
 * authored Effect, so resistance, immunity, temporary hit points, Concentration and defeat settle
 * through the same graphs as any other damage. `actorId` is the creature whose push it is and
 * `sourceId` names the one collision (a uuid), which the stored execution records.
 */
export function collisionDamageCapability(input: {
  actorId: string
  gameSystemId: string
  sourceId: string
  damageTypeId: CharacterRuleActionForcedMovementCollision['damageTypeId']
  diceConfig: string
}): EncounterBasicActionCapabilityDescriptor {
  const { actorId, gameSystemId, sourceId } = input
  return collisionCapability({
    actorId,
    gameSystemId,
    sourceId,
    save: null,
    conditionId: null,
    outcomes: [damageOutcome(`${sourceId}__path`, input.damageTypeId, input.diceConfig)]
  })
}

/**
 * The action a struck creature's collision runs as (D159): the authored Dexterity-style save against
 * the authored DC, and on a failure the mover's collision damage (none when it travelled under 10
 * feet) and the authored condition. The pusher's action, so the save sees the pusher as its source.
 */
export function collisionStruckCapability(input: {
  actorId: string
  gameSystemId: string
  sourceId: string
  struck: Pick<
    CharacterRuleActionForcedMovementCollision,
    'damageTypeId' | 'abilityDefinitionId' | 'dc' | 'conditionId'
  > & { damageDiceConfig: string | null }
}): EncounterBasicActionCapabilityDescriptor {
  const { actorId, gameSystemId, sourceId, struck } = input
  const pathId = `${sourceId}__path`
  return collisionCapability({
    actorId,
    gameSystemId,
    sourceId,
    save: { abilityDefinitionId: struck.abilityDefinitionId, dc: struck.dc },
    conditionId: struck.conditionId,
    outcomes: [
      ...(struck.damageDiceConfig === null
        ? []
        : [damageOutcome(pathId, struck.damageTypeId, struck.damageDiceConfig)]),
      conditionOutcome(pathId, struck.conditionId)
    ]
  })
}

const conditionOutcome = (pathId: string, conditionId: string) => ({
  id: `${pathId}__condition`,
  effectKind: EFFECT_KIND.CONDITION,
  conditionId
})

const damageOutcome = (pathId: string, damageTypeId: string, diceConfig: string) => ({
  id: `${pathId}__damage`,
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId,
  valueKind: 'DICE' as const,
  diceConfig,
  scalingKind: 'NONE' as const
})

function collisionCapability(input: {
  actorId: string
  gameSystemId: string
  sourceId: string
  /** The save a struck creature makes, or null for the unsaved damage a mover takes. */
  save: { abilityDefinitionId: string; dc: number } | null
  /** The condition a failed save leaves, which the capability must be bound to. */
  conditionId: string | null
  outcomes: (ReturnType<typeof damageOutcome> | ReturnType<typeof conditionOutcome>)[]
}): EncounterBasicActionCapabilityDescriptor {
  const effectId = input.sourceId
  const pathId = `${effectId}__path`
  const invocation = {
    kind: 'ACTION' as const,
    activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
    range: { id: `${effectId}__range`, rangeKind: RANGE_KIND.UNLIMITED },
    targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
  }
  const effect = {
    id: effectId,
    order: 1,
    invocation: input.save
      ? {
          ...invocation,
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: `${effectId}__save`,
            dcMethod: 'FIXED_DC' as const,
            abilityDefinitionId: input.save.abilityDefinitionId,
            baseDc: input.save.dc
          }
        }
      : { ...invocation, triggerCode: TRIGGER.ACTIVATED },
    paths: [
      {
        id: pathId,
        order: 1,
        pathCode: input.save ? PATH_CODE.ON_SAVE_FAIL : PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: `${pathId}__result`,
          resultKind: 'SINGLE' as const,
          outcomes: input.outcomes
        }
      }
    ]
  }
  const compiledEffect = compileEffect(effect)
  const normalized = bindEncounterEffect({
    gameSystemId: input.gameSystemId,
    compiledEffect,
    conditionDefinitionIds: input.conditionId ? [input.conditionId] : [],
    abilityDefinitions: input.save ? [{ id: input.save.abilityDefinitionId, code: 'SAVE' }] : []
  })
  if (normalized === null) throw new Error('The forced-movement collision cannot run.')
  return {
    kind: 'BASIC_ACTION',
    gameSystemId: input.gameSystemId,
    authoredRootKind: 'effect',
    entryPointDefinitionId: effectId,
    effectId,
    actionId: `${input.actorId}:COLLISION:${effectId}`,
    sourceId: input.sourceId,
    label: 'Collision',
    restrictions: null,
    actionCost: 'FREE',
    mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
    conditionDefinitionIds: normalized.conditionDefinitionIds ?? [],
    savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
    compiledEffect,
    encounterActorId: input.actorId,
    definitionId: input.sourceId,
    definitionVersion: 0,
    definitionChecksum: checksumRuleDocument(effect),
    authoredEffectChecksum: checksumRuleDocument(effect),
    compiledEffectChecksum: checksumRuleDocument(compiledEffect)
  }
}
