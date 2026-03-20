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
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const clairvoyance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CLAIRVOYANCE,
  label: 'Clairvoyance',
  description:
    'You create an invisible sensor within range in a location familiar to you (a place you have visited or seen before) or in an obvious location that is unfamiliar to you (such as behind a closed door, around a corner, below the ground).',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.CLAIRVOYANCE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CLAIRVOYANCE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 1,
          unit: MEASUREMENT_UNIT_CODE.MILES
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Create an invisible sensor at a familiar or obvious location within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.CLAIRVOYANCE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.CLAIRVOYANCE, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 10
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.SENSOR,
          label: 'Clairvoyance Sensor',
          detail: 'Creates an invisible sensor that provides sight or hearing from the chosen location for the duration.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
