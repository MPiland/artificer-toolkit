import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const detectEvilAndGood: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DETECT_EVIL_AND_GOOD,
  label: 'Detect Evil and Good',
  description:
    'For the duration, you know if there is an aberration, celestial, elemental, fey, fiend, or undead within 30 feet of you, as well as where the creature is located. You also know if there is a place or object within 30 feet of you that has been consecrated or desecrated.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.DETECT_EVIL_AND_GOOD, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DETECT_EVIL_AND_GOOD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF',
          detail: 'Sense planar and consecration-aligned presences around you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.DETECT_EVIL_AND_GOOD, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.DETECT_EVIL_AND_GOOD, 0x213, 1),
            durationKind: 'MINUTE',
            amount: 10
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Detect Evil and Good',
          description:
            'For the duration, you sense whether certain creature types are within 30 feet of you, and you know the location of any such creature. You also sense consecrated or desecrated places and objects within 30 feet.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
