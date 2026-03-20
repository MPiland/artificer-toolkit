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

export const dimensionDoor: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DIMENSION_DOOR,
  label: 'Dimension Door',
  description:
    'You teleport yourself from your current location to any other spot within range. You arrive at exactly the spot desired.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.DIMENSION_DOOR, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DIMENSION_DOOR, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 500,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF,
          detail: 'Teleport yourself, optionally bringing one willing creature of your size or smaller.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.DIMENSION_DOOR, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.TELEPORT,
          targetKind: 'SELF',
          destinationKind: 'SPECIFIED_POINT',
          detail:
            'Teleport yourself to a specified point within range, optionally bringing one willing creature of your size or smaller.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
