import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
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

export const prismaticWall: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PRISMATIC_WALL,
  label: 'Prismatic Wall',
  description:
    'A shimmering, multicolored plane of light forms a vertical opaque wall centered on a point you can see within range. Alternatively, you can shape the wall into a sphere.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x201, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 60,
    unit: MEASUREMENT_UNIT_CODE.FEET
  },
  duration: {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x202, 1),
    durationKind: 'MINUTE',
    amount: 10
  },
  level: 9,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ABJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose a point within range to create the prismatic wall.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Prismatic Wall',
          description:
            'Creates a multicolored wall or sphere of light with layered magical effects under the spell’s normal rules.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
