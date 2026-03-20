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

export const majorImage: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MAJOR_IMAGE,
  label: 'Major Image',
  description:
    'You create the image of an object, a creature, or some other visible phenomenon no larger than a 20-foot cube. It can include sound, smell, and temperature and can be moved or altered while you remain within range.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  atHigherLevels:
    'When you cast this spell using a spell slot of 6th level or higher, the spell lasts until dispelled, without requiring your concentration.',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MAJOR_IMAGE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MAJOR_IMAGE, 0x201, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Create the image within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MAJOR_IMAGE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MAJOR_IMAGE, 0x202, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 10
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Major Image',
          description:
            'Creates a sound, smell, and temperature capable visual illusion that can be moved or altered while you remain within range.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
