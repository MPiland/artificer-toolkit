import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const detectThoughts: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DETECT_THOUGHTS,
  label: 'Detect Thoughts',
  description:
    'For the duration, you can read the surface thoughts of certain creatures within range. You can also probe deeper into a target creature, but that requires a saving throw and can reveal more information.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.DETECT_THOUGHTS, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DETECT_THOUGHTS, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF',
          detail: 'Read the surface thoughts of a creature within range, or probe deeper after establishing a link.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.DETECT_THOUGHTS, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.DETECT_THOUGHTS, 0x213, 1),
            durationKind: 'MINUTE',
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Detect Thoughts',
          description:
            'For the duration, you can sense and read surface thoughts and, when you maintain the link, probe deeper thoughts through a saving throw-based interaction.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
