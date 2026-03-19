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
  SCALING_AMOUNT_KIND,
  SCALING,
  SCALING_SOURCE,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const fingerOfDeath: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FINGER_OF_DEATH,
  label: 'Finger of Death',
  description:
    'You send negative energy coursing through a creature that you can see within range, causing it searing pain. The target must make a Constitution saving throw. It takes 7d8 + 30 necrotic damage on a failed save, or half as much damage on a successful one.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('NECROMANCY'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x214, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Send necrotic energy at one creature you can see within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x212, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('NECROTIC'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x212, 2), level: 7, order: 1, diceConfig: '7d8+30' },
            { id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x212, 3), level: 8, order: 2, diceConfig: '7d8+30' },
            { id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x212, 4), level: 9, order: 3, diceConfig: '7d8+30' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Rider',
          description:
            'If this reduces the target to 0 hit points, it dies and rises as a zombie in the SRD text, which remains a constrained rules fallback here.'
        },
        {
          id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x214, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('NECROTIC'),
          amountKind: SCALING_AMOUNT_KIND.HALF,
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x214, 2), level: 7, order: 1, diceConfig: '7d8+30' },
            { id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x214, 3), level: 8, order: 2, diceConfig: '7d8+30' },
            { id: spellChildId(SPELL_IDS.FINGER_OF_DEATH, 0x214, 4), level: 9, order: 3, diceConfig: '7d8+30' }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
