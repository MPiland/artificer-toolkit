import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const shatter: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHATTER,
  label: 'Shatter',
  description:
    "<p>A sudden loud ringing noise, painfully intense, erupts from a point of your choice within range. Each creature in a 10-foot-radius sphere centered on that point must make a Constitution saving throw. A creature takes 3d8 thunder damage on a failed save, or half as much damage on a successful one. A creature made of inorganic material such as stone, crystal, or metal has disadvantage on this saving throw. A nonmagical object that isn't being worn or carried also takes the damage if it's in the spell's area. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a chip of mica',
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SHATTER, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.SHATTER, 0x214, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHATTER, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.SHATTER, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 10,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SHATTER, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SHATTER, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SHATTER, 0x213, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('THUNDER'),
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 2),
                    level: 2,
                    order: 1,
                    diceConfig: '3d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 3),
                    level: 3,
                    order: 2,
                    diceConfig: '4d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 4),
                    level: 4,
                    order: 3,
                    diceConfig: '5d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 5),
                    level: 5,
                    order: 4,
                    diceConfig: '6d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 6),
                    level: 6,
                    order: 5,
                    diceConfig: '7d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 7),
                    level: 7,
                    order: 6,
                    diceConfig: '8d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 8),
                    level: 8,
                    order: 7,
                    diceConfig: '9d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x213, 9),
                    level: 9,
                    order: 8,
                    diceConfig: '10d8'
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.SHATTER, 0x216, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SHATTER, 0x216, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SHATTER, 0x216, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('THUNDER'),
                amountKind: SCALING_AMOUNT_KIND.HALF,
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 2),
                    level: 2,
                    order: 1,
                    diceConfig: '3d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 3),
                    level: 3,
                    order: 2,
                    diceConfig: '4d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 4),
                    level: 4,
                    order: 3,
                    diceConfig: '5d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 5),
                    level: 5,
                    order: 4,
                    diceConfig: '6d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 6),
                    level: 6,
                    order: 5,
                    diceConfig: '7d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 7),
                    level: 7,
                    order: 6,
                    diceConfig: '8d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 8),
                    level: 8,
                    order: 7,
                    diceConfig: '9d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHATTER, 0x216, 9),
                    level: 9,
                    order: 8,
                    diceConfig: '10d8'
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
