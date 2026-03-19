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
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const freezingSphere: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FREEZING_SPHERE,
  label: 'Freezing Sphere',
  description:
    'A frigid globe of cold energy streaks from your fingertips to a point of your choice within range, where it explodes in a 60-foot-radius sphere.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('EVOCATION'),
  materialDescription: 'a small crystal sphere',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FREEZING_SPHERE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.FREEZING_SPHERE, 0x211, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.DEXTERITY
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FREEZING_SPHERE, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 300,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose a point within range; creatures in the 60-foot-radius sphere are affected.'
        },
        shape: {
          id: spellChildId(SPELL_IDS.FREEZING_SPHERE, 0x213, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 60,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FREEZING_SPHERE, 0x214, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('COLD'),
          valueKind: 'DICE',
          scalingKind: SCALING.NONE,
          diceConfig: '10d6'
        },
        {
          id: spellChildId(SPELL_IDS.FREEZING_SPHERE, 0x215, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('COLD'),
          amountKind: SCALING_AMOUNT_KIND.HALF,
          valueKind: 'DICE',
          scalingKind: SCALING.NONE,
          diceConfig: '10d6'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
