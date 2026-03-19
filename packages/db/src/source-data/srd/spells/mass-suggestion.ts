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

export const massSuggestion: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MASS_SUGGESTION,
  label: 'Mass Suggestion',
  description:
    'You suggest a course of activity and magically influence up to twelve creatures of your choice that you can see within range and that can hear and understand you.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ENCHANTMENT'),
  materialDescription: "a snake's tongue and either a bit of honeycomb or a drop of sweet oil",
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MASS_SUGGESTION, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MASS_SUGGESTION, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 12,
          detail: 'Choose up to twelve creatures that can hear and understand you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MASS_SUGGESTION, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MASS_SUGGESTION, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 24
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Mass Suggestion',
          description:
            'The current model does not yet honestly express a long-form compulsive suggestion applied across multiple creatures.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
