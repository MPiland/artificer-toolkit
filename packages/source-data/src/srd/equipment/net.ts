import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import * as S from './shared.js'
export const net: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(37),
  label: 'Net',
  description:
    'A Large or smaller creature hit by a net is restrained until it is freed. A net has no effect on creatures that are formless, or creatures that are Huge or larger. A creature can use its action to make a DC 10 Strength check, freeing itself or another creature within its reach on a success. Dealing 5 slashing damage to the net (AC 10) also frees the creature without harming it, ending the effect and destroying the net. When you use an action, bonus action, or reaction to attack with a net, you can make only one attack regardless of the number of attacks you can normally make.',
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.RANGED,
    S.EQUIPMENT_PROPERTY_CODE.THROWN,
    S.EQUIPMENT_PROPERTY_CODE.SPECIAL
  ],
  modifiers: S.thrownWeaponAbilityModifiers(S.equipId(37)),
  effects: [
    {
      id: S.equipmentChildId(S.equipId(37), 0x210, 1),
      order: 1,
      grip: S.EQUIPMENT_GRIP.ONE_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(37), 0x211, 1),
          rangeKind: S.RANGE_KIND.DISTANCE,
          amount: 5,
          longAmount: 15,
          unit: S.MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(37), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_HIT,
          groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(37), 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(37), 0x220, 1),
                effectKind: S.EFFECT_KIND.ACTOR_RELATIONSHIP,
                heldAtOnce: 1,
                modules: [
                  {
                    id: S.equipmentChildId(S.equipId(37), 0x221, 1),
                    order: 1,
                    kind: 'TARGET_SIZE_MAXIMUM' as const,
                    sizeCode: 'LARGE'
                  },
                  {
                    id: S.equipmentChildId(S.equipId(37), 0x222, 1),
                    order: 2,
                    kind: 'ESCAPE_CHECK' as const,
                    activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                    checks: {
                      skillIds: [],
                      abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH]
                    },
                    dc: { kind: 'FIXED' as const, value: 10 },
                    actorKinds: ['TARGET' as const, 'CREATURE_WITHIN_REACH' as const]
                  },
                  {
                    id: S.equipmentChildId(S.equipId(37), 0x223, 1),
                    order: 3,
                    kind: 'SOURCE_INDEPENDENT_HOLD' as const
                  }
                ],
                conditions: [
                  {
                    id: S.equipmentChildId(S.equipId(37), 0x224, 1),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: S.conditionTypeId('RESTRAINED')
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    {
      id: S.equipmentChildId(S.equipId(37), 0x230, 1),
      order: 2,
      grip: null,
      invocation: {
        kind: 'PASSIVE' as const,
        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
        range: {
          id: S.equipmentChildId(S.equipId(37), 0x231, 1),
          rangeKind: S.RANGE_KIND.SELF
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(37), 0x232, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_ATTACK,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${S.equipmentChildId(S.equipId(37), 0x232, 1)}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(37), 0x233, 1),
                effectKind: S.EFFECT_KIND.ACTION_ECONOMY_RULE,
                ruleKind: 'MAX_ATTACKS_PER_ACTIVATION' as const,
                maximum: 1
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(1),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
