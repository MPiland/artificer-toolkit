import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  DURATION_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const passwall: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PASSWALL,
  label: 'Passwall',
  description:
    'A passage appears at a point of your choice that you can see on a wooden, plaster, or stone surface within range, and it lasts for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.PASSWALL, 0x201, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 30,
    unit: MEASUREMENT_UNIT_CODE.FEET
  },
  duration: {
    id: spellChildId(SPELL_IDS.PASSWALL, 0x202, 1),
    durationKind: DURATION_KIND.HOUR,
    amount: 1
  },
  level: 5,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  materialDescription: 'a pinch of sesame seeds',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PASSWALL, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PASSWALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'A point on a wooden, plaster, or stone surface within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PASSWALL, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Passwall',
          description:
            'Creates a temporary passage through a surface. The passage dimensions and safe ejection behavior are not yet modeled as a typed manifest.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
