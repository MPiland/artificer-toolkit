import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const acidArrow: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ACID_ARROW,
  label: 'Acid Arrow',
  description:
    'A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. Make a ranged spell attack against the target. On a hit, the target takes 4d4 acid damage immediately and 2d4 acid damage at the end of its next turn.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.ACID_ARROW, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ACID_ARROW, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Hurl an acid arrow at one creature within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.ACID_ARROW, 0x212, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Acid Arrow',
          description:
            'On a hit, the target takes acid damage immediately and again at the end of its next turn.'
        },
        {
          id: spellChildId(SPELL_IDS.ACID_ARROW, 0x213, 1),
          branch: BRANCH.ON_MISS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Miss',
          description: 'On a miss, the arrow has no effect.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
