import {
  ABILITY_CODE,
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
export const burningHands: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BURNING_HANDS,
  label: 'Burning Hands',
  description:
    '<p>As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make a Dexterity saving throw, taking 3d6 fire damage on a failed save, or half as much damage on a successful one.</p><p><strong>At Higher Levels.</strong> When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x214, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.DEXTERITY
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x212, 1),
          shapeKind: SHAPE_KIND.CONE,
          length: {
            amount: 15,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FIRE'),
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 2),
                    level: 1,
                    order: 1,
                    diceConfig: '3d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 3),
                    level: 2,
                    order: 2,
                    diceConfig: '4d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 4),
                    level: 3,
                    order: 3,
                    diceConfig: '5d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 5),
                    level: 4,
                    order: 4,
                    diceConfig: '6d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 6),
                    level: 5,
                    order: 5,
                    diceConfig: '7d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 7),
                    level: 6,
                    order: 6,
                    diceConfig: '8d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 8),
                    level: 7,
                    order: 7,
                    diceConfig: '9d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 9),
                    level: 8,
                    order: 8,
                    diceConfig: '10d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x213, 10),
                    level: 9,
                    order: 9,
                    diceConfig: '11d6'
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FIRE'),
                amountKind: SCALING_AMOUNT_KIND.HALF,
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 2),
                    level: 1,
                    order: 1,
                    diceConfig: '3d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 3),
                    level: 2,
                    order: 2,
                    diceConfig: '4d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 4),
                    level: 3,
                    order: 3,
                    diceConfig: '5d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 5),
                    level: 4,
                    order: 4,
                    diceConfig: '6d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 6),
                    level: 5,
                    order: 5,
                    diceConfig: '7d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 7),
                    level: 6,
                    order: 6,
                    diceConfig: '8d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 8),
                    level: 7,
                    order: 7,
                    diceConfig: '9d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 9),
                    level: 8,
                    order: 8,
                    diceConfig: '10d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.BURNING_HANDS, 0x216, 10),
                    level: 9,
                    order: 9,
                    diceConfig: '11d6'
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
