import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  DURATION_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const stoneShape: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.STONE_SHAPE,
  label: 'Stone Shape',
  description:
    'You touch a stone object of Medium size or smaller or a section of stone no more than 5 feet in any dimension and form it into any shape that suits your purpose.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.STONE_SHAPE, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.STONE_SHAPE, 0x202, 1),
    durationKind: DURATION_KIND.INSTANTANEOUS
  },
  level: 4,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  materialDescription: 'soft clay, which must be worked into roughly the desired shape of the stone object',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.STONE_SHAPE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.STONE_SHAPE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch a stone object or section of stone.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.STONE_SHAPE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Stone Shape',
          description:
            'Transforms the touched stone into the desired shape. Fine mechanical detail and related object identity changes remain in prose.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
