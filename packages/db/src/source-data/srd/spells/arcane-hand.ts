import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
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

export const arcaneHand: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ARCANE_HAND,
  label: 'Arcane Hand',
  description:
    "You create a Large hand of shimmering, translucent force in an unoccupied space that you can see within range. The hand lasts for the spell's duration, and it moves at your command, mimicking the movements of your own hand.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Create the hand in an unoccupied space within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.OBJECT,
          label: 'Arcane Hand',
          detail:
            'Creates a Large hand of force that moves at your command and can be directed by later capabilities if the model supports them.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
