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

export const featherFall: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FEATHER_FALL,
  label: 'Feather Fall',
  description:
    'Choose up to five falling creatures within range. A falling creature’s rate of descent slows to 60 feet per round until the spell ends. If the creature lands before the spell ends, it takes no falling damage and can land on its feet.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FEATHER_FALL, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.REACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FEATHER_FALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 5,
          detail: 'Choose up to five falling creatures within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FEATHER_FALL, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.FEATHER_FALL, 0x213, 1),
            durationKind: 'MINUTE',
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Feather Fall',
          description:
            'Chosen falling creatures descend at 60 feet per round for the duration and take no falling damage if they land before the spell ends.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
