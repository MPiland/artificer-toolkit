import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const windWall: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WIND_WALL,
  label: 'Wind Wall',
  description:
    'A wall of strong wind rises from the ground at a point you choose within range. You can make the wall up to 50 feet long, 15 feet high, and 1 foot thick, and it lasts for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.WIND_WALL, 0x201, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 120,
    unit: MEASUREMENT_UNIT_CODE.FEET
  },
  level: 3,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  materialDescription: 'a tiny fan and a feather of exotic origin',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.WIND_WALL, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WIND_WALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'A wall of strong wind rises from a point within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.WIND_WALL, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.WIND_WALL, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.ZONE,
          label: 'Wind Wall',
          detail:
            'Creates a wall of strong wind that blocks line of sight and pushes back gases, vapors, and small flying creatures.',
          shape: {
            id: spellChildId(SPELL_IDS.WIND_WALL, 0x214, 1),
            shapeKind: SHAPE_KIND.WALL,
            length: {
              amount: 50,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            height: {
              amount: 15,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            thickness: {
              amount: 1,
              unit: MEASUREMENT_UNIT_CODE.FEET
            }
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
