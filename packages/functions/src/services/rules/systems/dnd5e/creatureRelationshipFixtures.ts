import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterActionMechanicFacts } from '../../../character/characterActionRuleFacts.js'
import type { EncounterFeatureActionCapabilityDescriptor } from '../../encounterFeatureActionCapabilityDiscovery.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

const ids = {
  breathing: '00000000-0000-4000-8000-000000009801',
  blinded: '00000000-0000-4000-8000-000000009802',
  grappled: '00000000-0000-4000-8000-000000009803',
  restrained: '00000000-0000-4000-8000-000000009804',
  strength: '00000000-0000-4000-8000-000000009805',
  constitution: '00000000-0000-4000-8000-000000009806',
  bludgeoning: '00000000-0000-4000-8000-000000009807',
  piercing: '00000000-0000-4000-8000-000000009808'
} as const

type CreatureFixtureKind = 'CLOAKER_BITE' | 'RUG_SMOTHER' | 'CLAY_GOLEM_SLAM'

function identity(kind: CreatureFixtureKind) {
  const offset = kind === 'CLOAKER_BITE' ? 10 : kind === 'RUG_SMOTHER' ? 30 : 50
  const uuid = (value: number) =>
    `00000000-0000-4000-8000-${String(9800 + offset + value).padStart(12, '0')}`
  return {
    actorId: uuid(1),
    creatureId: uuid(2),
    featureId: uuid(3),
    effectId: uuid(4),
    sourceVersionId: uuid(5),
    attackId: uuid(6),
    damageId: uuid(7),
    relationshipId: uuid(8),
    followUpId: uuid(9),
    reductionId: uuid(10),
    moduleA: uuid(11),
    moduleB: uuid(12),
    moduleC: uuid(13),
    conditionA: uuid(14),
    conditionB: uuid(15),
    conditionC: uuid(16),
    recurrenceDamageId: uuid(17),
    bonusId: uuid(18),
    savingThrowId: uuid(19)
  }
}

function capability(input: {
  kind: CreatureFixtureKind
  abilityScores: Readonly<Record<string, number>>
  compiledEffect: ReturnType<typeof compileEffect>
  conditionDefinitionIds?: readonly string[]
}): EncounterFeatureActionCapabilityDescriptor {
  const source = identity(input.kind)
  return {
    kind: 'ENCOUNTER_FEATURE',
    label: input.kind,
    encounterActorId: source.actorId,
    creatureSourceId: source.creatureId,
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: source.effectId,
    effectId: source.effectId,
    actionId: `${source.featureId}:ACTION:${source.effectId}`,
    sourceId: source.featureId,
    mechanicFacts: normalizeCharacterActionMechanicFacts(input.compiledEffect),
    conditionDefinitionIds: input.conditionDefinitionIds ?? [],
    savingThrowAbilityDefinitionId: null,
    compiledEffect: input.compiledEffect,
    ownerFeatureId: source.featureId,
    featureOptionId: null,
    ownerRuleDefinitionIds: [],
    optionRuleDefinitionIds: [],
    sourceRevision: 1,
    sourceVersionId: source.sourceVersionId,
    sourceChecksum: 'a'.repeat(64),
    authoredEffectChecksum: checksumRuleDocument(input.compiledEffect),
    compiledEffectChecksum: checksumRuleDocument(input.compiledEffect),
    featureResourceUse: null,
    equipmentBinding: null,
    attackMechanic: {
      rollDefinitionId: source.attackId,
      attackBonus: input.kind === 'CLAY_GOLEM_SLAM' ? 8 : input.kind === 'CLOAKER_BITE' ? 6 : 5,
      rollMode: 'NORMAL',
      definitionChecksum: checksumRuleDocument({
        kind: input.kind,
        abilityScores: input.abilityScores
      })
    }
  }
}

export function cloakerBiteFixture() {
  const source = identity('CLOAKER_BITE')
  const compiledEffect = compileEffect({
    id: source.effectId,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: source.attackId, rangeKind: RANGE_KIND.DISTANCE, amount: 5, unit: 'FEET' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    },
    paths: [
      {
        id: source.attackId,
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SEQUENTIAL,
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${source.attackId}-result`,
          resultKind: 'SEQUENCE',
          outcomes: [
            {
              id: source.damageId,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: ids.piercing,
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '2d6',
              bonuses: [
                { id: source.bonusId, bonusKind: 'ABILITY_BONUS', ability: 'STRENGTH', order: 1 }
              ]
            },
            {
              id: source.relationshipId,
              effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP,
              modules: [
                { id: source.moduleA, order: 1, kind: 'TARGET_SIZE_MAXIMUM', sizeCode: 'LARGE' }
              ],
              conditions: []
            }
          ]
        }
      }
    ]
  })
  return {
    capability: capability({
      kind: 'CLOAKER_BITE',
      abilityScores: { STRENGTH: 16 },
      compiledEffect
    }),
    source,
    abilityScores: { STRENGTH: 16 }
  }
}

export function rugSmotherFixture() {
  const source = identity('RUG_SMOTHER')
  const compiledEffect = compileEffect({
    id: source.effectId,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: source.attackId, rangeKind: RANGE_KIND.DISTANCE, amount: 5, unit: 'FEET' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    },
    paths: [
      {
        id: source.attackId,
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SEQUENTIAL,
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${source.attackId}-result`,
          resultKind: 'SEQUENCE',
          outcomes: [
            {
              id: source.relationshipId,
              effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP,
              modules: [
                { id: source.moduleA, order: 1, kind: 'TARGET_SIZE_MAXIMUM', sizeCode: 'MEDIUM' },
                { id: source.moduleB, order: 2, kind: 'SOURCE_EXCLUSIVE_TARGET', maximum: 1 },
                {
                  id: source.moduleC,
                  order: 3,
                  kind: 'TARGET_CAPABILITY_SUPPRESSION',
                  capabilityDefinitionIds: [ids.breathing]
                }
              ],
              conditions: [
                {
                  id: source.conditionA,
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: ids.grappled
                },
                {
                  id: source.conditionB,
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: ids.restrained
                },
                {
                  id: source.conditionC,
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: ids.blinded
                }
              ],
              recurrence: {
                stage: 'START_OF_TURN',
                damage: {
                  id: source.recurrenceDamageId,
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: ids.bludgeoning,
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '2d6+3'
                }
              }
            }
          ]
        }
      }
    ]
  })
  return {
    capability: capability({
      kind: 'RUG_SMOTHER',
      abilityScores: { STRENGTH: 17 },
      compiledEffect,
      conditionDefinitionIds: [ids.grappled, ids.restrained, ids.blinded]
    }),
    source,
    abilityScores: { STRENGTH: 17 }
  }
}

export function clayGolemSlamFixture() {
  const source = identity('CLAY_GOLEM_SLAM')
  const compiledEffect = compileEffect({
    id: source.effectId,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: source.attackId, rangeKind: RANGE_KIND.DISTANCE, amount: 5, unit: 'FEET' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    },
    paths: [
      {
        id: source.attackId,
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SEQUENTIAL,
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${source.attackId}-result`,
          resultKind: 'SEQUENCE',
          outcomes: [
            {
              id: source.damageId,
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: ids.bludgeoning,
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '2d10',
              bonuses: [
                { id: source.bonusId, bonusKind: 'ABILITY_BONUS', ability: 'STRENGTH', order: 1 }
              ]
            },
            {
              id: source.followUpId,
              effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
              timing: 'IMMEDIATE',
              savingThrow: {
                id: source.savingThrowId,
                dcMethod: 'FIXED_DC',
                abilityDefinitionId: ids.constitution,
                baseDc: 15
              },
              attempts: { kind: 'ONCE' },
              onSuccess: { kind: 'END' },
              onFailure: {
                kind: 'OUTCOMES',
                endCurrent: true,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: source.reductionId,
                    effectKind: EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
                    amountSource: { kind: 'DAMAGE_TAKEN', damageOutcomeId: source.damageId },
                    recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  })
  return {
    capability: capability({
      kind: 'CLAY_GOLEM_SLAM',
      abilityScores: { STRENGTH: 20 },
      compiledEffect,
      conditionDefinitionIds: []
    }),
    source,
    abilityScores: { STRENGTH: 20 },
    damageTypeId: ids.bludgeoning
  }
}
