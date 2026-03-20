import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const fabricate: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FABRICATE,
  label: 'Fabricate',
  description:
    'You convert raw materials into products of the same material. For example, you can fabricate a wooden bridge from a clump of trees, a rope from a patch of hemp, and clothes from flax or wool.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FABRICATE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FABRICATE, 0x211, 1),
          rangeKind: RANGE_KIND.SIGHT
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose raw material within sight to convert into an object or structure.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FABRICATE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Fabricate',
          description:
            'Converts raw material into a finished product. The material-translation and crafting-output limits remain prose-bound.'
        }
      ]
    }
  ]
}
