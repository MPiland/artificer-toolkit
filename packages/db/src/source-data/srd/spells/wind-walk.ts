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
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const windWalk: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WIND_WALK,
  label: 'Wind Walk',
  description:
    'You and up to ten willing creatures within range become cloudlike forms with great speed, and can later spend a minute returning to flesh or back to vapor before the spell ends.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('TRANSMUTATION'),
  materialDescription: 'fire and holy water',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.WIND_WALK, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WIND_WALK, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 11,
          detail: 'Choose yourself and up to ten willing creatures within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.WIND_WALK, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.WIND_WALK, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 8
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Wind Walk',
          description:
            'Transforms the chosen creatures into cloudlike forms with the spell’s full movement and reversion rules.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
