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
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const disintegrate: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DISINTEGRATE,
  label: 'Disintegrate',
  description:
    'A thin green ray springs from your pointing finger toward a target you can see within range. The target must make a Dexterity saving throw. On a failed save, the target takes 10d6 + 40 force damage, and a creature reduced to 0 hit points by this spell is disintegrated.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.DEXTERITY
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Send the ray at one target you can see within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x212, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('FORCE'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x212, 2), level: 6, order: 1, diceConfig: '10d6+40' },
            { id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x212, 3), level: 7, order: 2, diceConfig: '13d6+40' },
            { id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x212, 4), level: 8, order: 3, diceConfig: '16d6+40' },
            { id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x212, 5), level: 9, order: 4, diceConfig: '19d6+40' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.DISINTEGRATE, 0x213, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Successful Save',
          description: 'On a successful save, the spell has no effect.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
