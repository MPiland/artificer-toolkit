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

export const aid: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.AID,
  label: 'Aid',
  description:
    "Your spell bolsters your allies with toughness and resolve. Choose up to three creatures within range. Each target's hit point maximum and current hit points increase by 5 for the duration.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('ABJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.AID, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.AID, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 3,
          detail: 'Choose up to three creatures within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.AID, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.AID, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 8
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Aid',
          description:
            'This spell currently needs a combined max-hit-point and current-hit-point model to express the full SRD behavior honestly.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
