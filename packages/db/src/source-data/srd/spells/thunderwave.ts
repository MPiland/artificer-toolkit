import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SHAPE_KIND,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const thunderwave: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.THUNDERWAVE,
  label: 'Thunderwave',
  description:
    'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw or take thunder damage and be pushed away from you.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x211, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
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
          detail: 'Each creature in the cube.'
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
      branches: [
        {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('THUNDER'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 2), level: 1, order: 1, diceConfig: '2d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 3), level: 2, order: 2, diceConfig: '3d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 4), level: 3, order: 3, diceConfig: '4d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 5), level: 4, order: 4, diceConfig: '5d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 6), level: 5, order: 5, diceConfig: '6d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 7), level: 6, order: 6, diceConfig: '7d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 8), level: 7, order: 7, diceConfig: '8d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 9), level: 8, order: 8, diceConfig: '9d8' },
            { id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x214, 10), level: 9, order: 9, diceConfig: '10d8' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.THUNDERWAVE, 0x215, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Successful Save',
          description: 'On a successful save, the creature takes no damage and is not pushed.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
