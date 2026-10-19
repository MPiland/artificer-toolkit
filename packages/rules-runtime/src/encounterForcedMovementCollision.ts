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
import { bindEncounterEffect } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'

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
  const effectId = input.sourceId
  const pathId = `${effectId}__path`
  const effect = {
    id: effectId,
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: `${effectId}__range`, rangeKind: RANGE_KIND.UNLIMITED },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
    },
    paths: [
      {
        id: pathId,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: `${pathId}__result`,
          resultKind: 'SINGLE' as const,
          outcomes: [
            {
              id: `${pathId}__damage`,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: input.damageTypeId,
              valueKind: 'DICE' as const,
              diceConfig: input.diceConfig,
              scalingKind: 'NONE' as const
            }
          ]
        }
      }
    ]
  }
  const compiledEffect = compileEffect(effect)
  const normalized = bindEncounterEffect({
    gameSystemId: input.gameSystemId,
    compiledEffect,
    conditionDefinitionIds: [],
    abilityDefinitions: []
  })
  if (normalized === null) throw new Error('The forced-movement collision damage cannot run.')
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
