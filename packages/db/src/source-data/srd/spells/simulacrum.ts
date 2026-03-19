import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const simulacrum: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SIMULACRUM,
  label: 'Simulacrum',
  description:
    'You shape snow or ice into an illusory duplicate of a beast or humanoid, creating a partially real copy with half the original\'s hit point maximum that lasts until dispelled.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 12 },
  level: 7,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  materialDescription:
    'snow or ice in quantities sufficient to make a life-size copy of the duplicated creature; some hair, fingernail clippings, or another piece of that creature; and powdered ruby worth 1,500 gp, consumed by the spell',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.SIMULACRUM, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SIMULACRUM, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch the prepared snow or ice duplicate or the creature being copied.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.SIMULACRUM, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.SIMULACRUM, 0x213, 1),
            durationKind: DURATION_KIND.UNTIL_DISPELLED
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.CREATURE,
          label: 'Simulacrum',
          detail:
            'Creates a partially real duplicate of the copied creature that persists until dispelled.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
