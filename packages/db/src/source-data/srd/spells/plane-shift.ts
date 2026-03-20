import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const planeShift: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PLANE_SHIFT,
  label: 'Plane Shift',
  description:
    'You and up to eight willing creatures who link hands in a circle are transported to a different plane of existence. You can also use the spell to banish an unwilling creature you touch to another plane on a failed Charisma save.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.PLANE_SHIFT, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.PLANE_SHIFT, 0x202, 1),
    durationKind: DURATION_KIND.INSTANTANEOUS
  },
  level: 7,
  classIds: [
    CLASS_IDS.CLERIC,
    CLASS_IDS.DRUID,
    CLASS_IDS.SORCERER,
    CLASS_IDS.WARLOCK,
    CLASS_IDS.WIZARD
  ],
  magicSchoolId: schoolId('CONJURATION'),
  materialDescription:
    'a forked, metal rod worth at least 250 gp, attuned to a particular plane of existence',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PLANE_SHIFT, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PLANE_SHIFT, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 8,
          detail: 'Link hands with willing creatures in a circle or touch one unwilling creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PLANE_SHIFT, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Plane Shift',
          description:
            'The chosen creatures are transported to another plane under the spell’s rules.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
