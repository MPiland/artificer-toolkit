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

export const trueStrike: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TRUE_STRIKE,
  label: 'True Strike',
  description:
    "You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target's defenses, giving you advantage on your next attack roll against it before the end of your next turn.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x201, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 30,
    unit: MEASUREMENT_UNIT_CODE.FEET
  },
  duration: {
    id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x202, 1),
    durationKind: 'ROUND',
    amount: 1
  },
  level: 0,
  classIds: [CLASS_IDS.WARLOCK],
  magicSchoolId: schoolId('DIVINATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Choose one target within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x213, 1),
            durationKind: DURATION_KIND.ROUND,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'True Strike',
          description:
            'Grants brief insight into the target\'s defenses, but the current model does not yet express the one-shot attack-roll advantage rider structurally.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
