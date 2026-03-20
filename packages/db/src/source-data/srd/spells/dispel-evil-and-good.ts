import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { spellChildId } from './shared.js'

export const dispelEvilAndGood: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DISPEL_EVIL_AND_GOOD,
  label: 'Dispel Evil and Good',
  description:
    'Shimmering energy surrounds and protects you from celestials, elementals, fey, fiends, and undead. While the spell lasts, those creatures have disadvantage on attack rolls against you, and you can end the spell early to break enchantment or attempt dismissal.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF,
          detail: 'The protection surrounds you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.DISPEL_EVIL_AND_GOOD, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Dispel Evil and Good',
          description:
            'The current model does not yet honestly express the creature-type keyed protection, banishment, and dismissal behavior.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
