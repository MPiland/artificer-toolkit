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

export const feeblemind: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FEEBLEMIND,
  label: 'Feeblemind',
  description:
    'You blast the mind of a creature you can see within range, attempting to shatter its intellect and personality. The target takes 4d6 psychic damage and must make an Intelligence saving throw.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 8,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ENCHANTMENT'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FEEBLEMIND, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FEEBLEMIND, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 150,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Choose one creature you can see within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FEEBLEMIND, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Feeblemind',
          description:
            'Deals psychic damage and forces the spell’s Intelligence save, with the full mind-shattering consequences remaining prose-bound.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
