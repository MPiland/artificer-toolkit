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

export const mirrorImage: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MIRROR_IMAGE,
  label: 'Mirror Image',
  description:
    'Three illusory duplicates of yourself appear in your space. Until the spell ends, the duplicates move with you and mimic your actions.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF,
          detail: 'Create illusory duplicates in your own space.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MIRROR_IMAGE, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Mirror Image',
          description:
            'Creates three illusory duplicates that interfere with attacks against you for the duration. This still needs a richer illusion-defense and attack-redirection model.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
