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

export const conjureElemental: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CONJURE_ELEMENTAL,
  label: 'Conjure Elemental',
  description:
    'You call forth an elemental servant. Choose an area of air, earth, fire, or water that fills a 10-foot cube within range. An elemental of challenge rating 5 or lower appropriate to the area you chose appears in an unoccupied space within 10 feet of it.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.CONJURE_ELEMENTAL, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CONJURE_ELEMENTAL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose the elemental-appropriate space within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.CONJURE_ELEMENTAL, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.CONJURE_ELEMENTAL, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 1
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.CREATURE,
          label: 'Conjure Elemental',
          detail: 'Summons an elemental ally suited to the chosen elemental space for the spell duration.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
