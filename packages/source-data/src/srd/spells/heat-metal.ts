import {
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EQUIPMENT_PROPERTY_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  SCALING,
  SCALING_SOURCE,
  VALUE_DOMAIN_CODE,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_MAGIC_SCHOOLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import { damageTypeId, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
const REPEATED_PATH_IDS = [0x213, 0x214, 0x215, 0x216].map((id) =>
  spellChildId(SPELL_IDS.HEAT_METAL, id, 1)
)

/**
 * The effect the cast leaves on the target (D166): it grants nothing, is bound to the heated item,
 * ends when the item is released, and offers the caster a Bonus Action repeat of the damage paths
 * until the Concentration ends. One per save result, authored alike.
 */
function repeatCarrierPath(
  pathCode: typeof PATH_CODE.ON_SAVE_FAIL | typeof PATH_CODE.ON_SAVE_SUCCESS,
  idKey: number,
  order: number
) {
  return {
    id: spellChildId(SPELL_IDS.HEAT_METAL, idKey, 1),
    order,
    pathCode,
    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    chosenItem: { requiredProperties: [EQUIPMENT_PROPERTY_CODE.METAL] },
    resultBlock: {
      id: spellChildId(SPELL_IDS.HEAT_METAL, idKey, 1) + '__result',
      resultKind: 'SEQUENCE' as const,
      duration: {
        id: spellChildId(SPELL_IDS.HEAT_METAL, idKey, 2),
        durationKind: DURATION_KIND.MINUTE,
        amount: 1
      },
      lifecycle: {
        endTriggers: [
          { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_CHOSEN_ITEM_RELEASED' }
        ],
        effectOffers: [
          {
            kind: 'REPEAT_SOURCE_PATH' as const,
            offeredTo: 'SOURCE' as const,
            activation: ACTIVATION_CODE.BONUS_ACTION,
            pathIds: REPEATED_PATH_IDS
          }
        ]
      },
      outcomes: [
        {
          id: spellChildId(SPELL_IDS.HEAT_METAL, idKey, 1),
          effectKind: EFFECT_KIND.APPLY_GRANT,
          bindsChosenItem: true,
          // The fail path's carrier is withheld when the same cast already made the target drop the item.
          ...(pathCode === PATH_CODE.ON_SAVE_FAIL && { unlessChosenItemReleased: true }),
          grants: {}
        }
      ]
    }
  }
}

export const heatMetal: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HEAT_METAL,
  label: 'Heat Metal',
  description:
    "<p>Choose a manufactured metal object, such as a metal weapon or a suit of heavy or medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 fire damage when you cast the spell. Until the spell ends, you can use a bonus action on each of your subsequent turns to cause this damage again. If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn't drop the object, it has disadvantage on attack rolls and ability checks until the start of your next turn.</p><p>At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a piece of iron and a flame',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.HEAT_METAL, 0x217, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HEAT_METAL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          chosenItem: { requiredProperties: [EQUIPMENT_PROPERTY_CODE.METAL] },
          resultBlock: {
            id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FIRE'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 2),
                    level: 2,
                    order: 1,
                    diceConfig: '2d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 3),
                    level: 3,
                    order: 2,
                    diceConfig: '3d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 4),
                    level: 4,
                    order: 3,
                    diceConfig: '4d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 5),
                    level: 5,
                    order: 4,
                    diceConfig: '5d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 6),
                    level: 6,
                    order: 5,
                    diceConfig: '6d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 7),
                    level: 7,
                    order: 6,
                    diceConfig: '7d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 8),
                    level: 8,
                    order: 7,
                    diceConfig: '8d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 9),
                    level: 9,
                    order: 8,
                    diceConfig: '9d8'
                  }
                ]
              },
              {
                id: spellChildId(SPELL_IDS.HEAT_METAL, 0x213, 20),
                effectKind: EFFECT_KIND.RELEASE_CHOSEN_ITEM
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          chosenItem: { requiredProperties: [EQUIPMENT_PROPERTY_CODE.METAL] },
          resultBlock: {
            id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 2),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                unlessChosenItemReleased: true,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 5),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.SPELL },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 6),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.UNARMED },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 4
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x214, 7),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 5
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 1),
          order: 3,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          chosenItem: { requiredProperties: [EQUIPMENT_PROPERTY_CODE.METAL] },
          resultBlock: {
            id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FIRE'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 2),
                    level: 2,
                    order: 1,
                    diceConfig: '2d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 3),
                    level: 3,
                    order: 2,
                    diceConfig: '3d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 4),
                    level: 4,
                    order: 3,
                    diceConfig: '4d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 5),
                    level: 5,
                    order: 4,
                    diceConfig: '5d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 6),
                    level: 6,
                    order: 5,
                    diceConfig: '6d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 7),
                    level: 7,
                    order: 6,
                    diceConfig: '7d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 8),
                    level: 8,
                    order: 7,
                    diceConfig: '8d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.HEAT_METAL, 0x215, 9),
                    level: 9,
                    order: 8,
                    diceConfig: '9d8'
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 1),
          order: 4,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          chosenItem: { requiredProperties: [EQUIPMENT_PROPERTY_CODE.METAL] },
          resultBlock: {
            id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 2),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 5),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.SPELL },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 6),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.UNARMED },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 4
                    },
                    {
                      id: spellChildId(SPELL_IDS.HEAT_METAL, 0x216, 7),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 5
                    }
                  ]
                }
              }
            ]
          }
        },
        repeatCarrierPath(PATH_CODE.ON_SAVE_FAIL, 0x218, 5),
        repeatCarrierPath(PATH_CODE.ON_SAVE_SUCCESS, 0x219, 6)
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
