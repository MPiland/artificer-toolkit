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
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const projectImage: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PROJECT_IMAGE,
  label: 'Project Image',
  description:
    'You create an illusory copy of yourself that lasts for the duration. The copy can appear at any location within range that you have seen before, regardless of intervening obstacles.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  materialDescription: 'a small replica of you made from materials worth at least 5 gp',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PROJECT_IMAGE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PROJECT_IMAGE, 0x201, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 500,
          unit: MEASUREMENT_UNIT_CODE.MILES
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF,
          detail: 'Create an illusory copy of yourself at a place you have seen before.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PROJECT_IMAGE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.PROJECT_IMAGE, 0x202, 1),
            durationKind: DURATION_KIND.DAY,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Project Image',
          description:
            'Creates an illusory copy of the source that can appear remotely while the spell lasts.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
