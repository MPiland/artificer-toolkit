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

export const phantomSteed: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PHANTOM_STEED,
  label: 'Phantom Steed',
  description:
    'A Large quasi-real, horselike creature appears on the ground in an unoccupied space of your choice within range. It is equipped with a saddle, bit, and bridle, and it can be ridden for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x201, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 30,
    unit: MEASUREMENT_UNIT_CODE.FEET
  },
  duration: {
    id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x202, 1),
    durationKind: DURATION_KIND.HOUR,
    amount: 1
  },
  level: 3,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'An unoccupied space within range where the steed appears.'
        },
        shape: {
          id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x212, 1),
          shapeKind: SHAPE_KIND.CIRCLE,
          radius: {
            amount: 5,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x213, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.PHANTOM_STEED, 0x214, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 1
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.CREATURE,
          label: 'Phantom Steed',
          detail:
            'Creates a riding steed of illusory force that persists for the duration and can be mounted.'
        }
      ]
    }
  ]
}
