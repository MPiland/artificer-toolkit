import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const resurrection: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.RESURRECTION,
  label: 'Resurrection',
  description:
    'You touch a dead creature that has been dead for no more than a century and did not die of old age. If its soul is willing and free, the target returns to life with all its hit points.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.RESURRECTION, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.RESURRECTION, 0x202, 1),
    durationKind: DURATION_KIND.INSTANTANEOUS
  },
  level: 7,
  classIds: [CLASS_IDS.CLERIC],
  magicSchoolId: schoolId('NECROMANCY'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.RESURRECTION, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.RESURRECTION, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch one dead creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.RESURRECTION, 0x213, 1),
            durationKind: DURATION_KIND.INSTANTANEOUS
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Resurrection',
          description:
            'This spell currently needs a full resurrection and soul-restoration model to express the SRD behavior honestly.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
