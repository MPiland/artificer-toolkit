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

export const moveEarth: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MOVE_EARTH,
  label: 'Move Earth',
  description:
    'Choose an area of terrain no larger than 40 feet on a side within range. You can reshape dirt, sand, or clay in the area in any manner you choose for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  materialDescription: 'an iron blade and a small bag containing a mixture of soils, clay, loam, and sand',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MOVE_EARTH, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MOVE_EARTH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose an area of terrain no larger than 40 feet on a side within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MOVE_EARTH, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MOVE_EARTH, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 2
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Move Earth',
          description:
            'Reshapes dirt, sand, or clay in the chosen area. The terrain-rewriting rules remain prose-bound.'
        }
      ]
    }
  ]
}
