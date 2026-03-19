import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const regenerate: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.REGENERATE,
  label: 'Regenerate',
  description:
    'You awaken a creature\'s natural healing, restoring hit points immediately, causing steady recovery for the duration, and allowing severed body parts to regrow.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.REGENERATE, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.REGENERATE, 0x202, 1),
    durationKind: DURATION_KIND.HOUR,
    amount: 1
  },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('TRANSMUTATION'),
  materialDescription: 'a prayer wheel and holy water',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.REGENERATE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.REGENERATE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch one creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.REGENERATE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.REGENERATE, 0x213, 1),
            durationKind: DURATION_KIND.INSTANTANEOUS
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Regenerate',
          description:
            'This spell currently needs a richer regeneration, limb-restoration, and long-duration healing-state model to express the full SRD behavior honestly.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
