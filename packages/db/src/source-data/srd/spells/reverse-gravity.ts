import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const reverseGravity: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.REVERSE_GRAVITY,
  label: 'Reverse Gravity',
  description:
    'This spell reverses gravity in a large cylinder centered on a point within range. Unanchored creatures and objects fall upward, then fall back down when the spell ends.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.REVERSE_GRAVITY, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.REVERSE_GRAVITY, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 100,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose the cylindrical area whose gravity will be reversed.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.REVERSE_GRAVITY, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.REVERSE_GRAVITY, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Reverse Gravity',
          description:
            'Reverses gravity in the chosen cylinder and returns affected creatures and objects when the spell ends.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
