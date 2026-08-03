import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SHAPE_KIND,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const thunderwave: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.THUNDERWAVE,
  label: 'Thunderwave',
  description:
    "<p>A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw. On a failed save, a creature takes 2d8 thunder damage and is pushed 10 feet away from you. On a successful save, the creature takes half as much damage and isn't pushed. In addition, unsecured objects that are completely within the area of effect are automatically pushed 10 feet away from you by the spell's effect, and the spell emits a thunderous boom audible out to 300 feet. At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x212, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x213, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 15,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('THUNDER'),
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 2),
                    level: 1,
                    order: 1,
                    diceConfig: '2d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 3),
                    level: 2,
                    order: 2,
                    diceConfig: '3d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 4),
                    level: 3,
                    order: 3,
                    diceConfig: '4d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 5),
                    level: 4,
                    order: 4,
                    diceConfig: '5d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 6),
                    level: 5,
                    order: 5,
                    diceConfig: '6d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 7),
                    level: 6,
                    order: 6,
                    diceConfig: '7d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 8),
                    level: 7,
                    order: 7,
                    diceConfig: '8d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 9),
                    level: 8,
                    order: 8,
                    diceConfig: '9d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 10),
                    level: 9,
                    order: 9,
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
