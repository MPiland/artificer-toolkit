import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
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

export const foresight: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FORESIGHT,
  label: 'Foresight',
  description:
    "You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target can't be surprised and has advantage on attack rolls, ability checks, and saving throws.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('DIVINATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FORESIGHT, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FORESIGHT, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch one willing creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FORESIGHT, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.FORESIGHT, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 8
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Foresight',
          description:
            'Bestows the spell’s future-sight benefits for the duration. Surprise immunity and broad advantage coverage still remain prose-bound.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
