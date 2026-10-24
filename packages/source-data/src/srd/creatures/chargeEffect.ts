import type { EffectAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

/**
 * The printed Charge ("if the creature moves at least N feet straight toward a target and then hits
 * it with a <Feature> attack on the same turn, the target takes an extra X damage ... must succeed on
 * a DC N Strength saving throw or be [pushed up to P feet away and] knocked prone") as an `ON_HIT`
 * rider of that one Feature's attack, owed only after the move toward the target (D164). It takes
 * the IDs `actionId(creatureIndex, localIndex + 0..11)`.
 */
export function chargeEffect(input: {
  creatureIndex: number
  localIndex: number
  ridesFeatureId: string
  minFeet: number
  damageType: string
  diceConfig: string
  dc: number
  pushFeet?: number
}): EffectAuthored {
  const id = (offset: number) => S.actionId(input.creatureIndex, input.localIndex + offset)
  const prone = {
    id: id(10),
    effectKind: S.EFFECT_KIND.CONDITION,
    conditionId: conditionTypeId('PRONE')
  }
  return {
    id: id(0),
    order: 1,
    invocation: {
      kind: 'PASSIVE' as const,
      triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
      ridesFeatureId: input.ridesFeatureId,
      range: { id: id(1), rangeKind: S.RANGE_KIND.SPECIAL },
      targeting: {
        selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
      }
    },
    paths: [
      {
        id: id(2),
        order: 1,
        pathCode: S.PATH_CODE.ON_HIT,
        groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        restrictions: {
          id: id(3),
          groups: [
            {
              id: id(4),
              order: 0,
              contexts: [
                {
                  id: id(5),
                  order: 0,
                  subject: 'EQUIPMENT' as const,
                  authoringModeKind: 'ALL' as const,
                  conditions: [
                    {
                      id: id(6),
                      order: 0,
                      kind: 'PREDICATE' as const,
                      constraint: 'INCLUDE' as const,
                      predicateCode: 'MOVED_TOWARD_TARGET' as const,
                      minFeet: input.minFeet
                    }
                  ]
                }
              ]
            }
          ]
        },
        resultBlock: {
          id: `${id(2)}__result`,
          resultKind: 'SEQUENCE' as const,
          outcomes: [
            {
              id: id(7),
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId(input.damageType),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: input.diceConfig
            },
            {
              id: id(8),
              effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
              timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
              savingThrow: {
                id: id(9),
                dcMethod: 'FIXED_DC',
                abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.STRENGTH,
                baseDc: input.dc
              },
              attempts: { kind: 'ONCE' },
              onSuccess: { kind: 'END' },
              onFailure: {
                kind: 'OUTCOMES',
                endCurrent: false,
                ...(input.pushFeet === undefined
                  ? { resultKind: 'SINGLE' as const, outcomes: [prone] }
                  : {
                      resultKind: 'SEQUENCE' as const,
                      outcomes: [
                        {
                          id: id(11),
                          effectKind: S.EFFECT_KIND.FORCED_MOVEMENT,
                          direction: 'AWAY_FROM_SOURCE' as const,
                          actionEconomy: 'NONE' as const,
                          distanceMode: 'EXACT' as const,
                          amount: input.pushFeet,
                          unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        prone
                      ]
                    })
              }
            }
          ]
        }
      }
    ]
  }
}
