import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const planarAlly: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PLANAR_ALLY,
  label: 'Planar Ally',
  description:
    'You beseech an otherworldly entity for aid. That entity sends a celestial, an elemental, or a fiend loyal to it to aid you, making the creature appear in an unoccupied space within range.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 6,
  classIds: [CLASS_IDS.CLERIC],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PLANAR_ALLY, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PLANAR_ALLY, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose an unoccupied space within range where the ally appears.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PLANAR_ALLY, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.CREATURE,
          label: 'Planar Ally',
          detail:
            'Calls a celestial, elemental, or fiend to aid you, with payment and service terms still governed by the spell’s full SRD rules.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
