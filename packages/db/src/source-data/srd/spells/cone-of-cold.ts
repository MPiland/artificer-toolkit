import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
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
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const coneOfCold: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CONE_OF_COLD,
  label: 'Cone of Cold',
  description:
    'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw, taking 8d8 cold damage on a failed save, or half as much damage on a successful one.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Each creature in the cone.'
        },
        shape: {
          id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x212, 1),
          shapeKind: SHAPE_KIND.CONE,
          length: {
            amount: 60,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('COLD'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x213, 2), level: 5, order: 1, diceConfig: '8d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x213, 3), level: 6, order: 2, diceConfig: '9d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x213, 4), level: 7, order: 3, diceConfig: '10d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x213, 5), level: 8, order: 4, diceConfig: '11d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x213, 6), level: 9, order: 5, diceConfig: '12d8' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x216, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('COLD'),
          amountKind: SCALING_AMOUNT_KIND.HALF,
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x216, 2), level: 5, order: 1, diceConfig: '8d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x216, 3), level: 6, order: 2, diceConfig: '9d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x216, 4), level: 7, order: 3, diceConfig: '10d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x216, 5), level: 8, order: 4, diceConfig: '11d8' },
            { id: spellChildId(SPELL_IDS.CONE_OF_COLD, 0x216, 6), level: 9, order: 5, diceConfig: '12d8' }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
