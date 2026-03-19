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
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const stormOfVengeance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.STORM_OF_VENGEANCE,
  label: 'Storm of Vengeance',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    'You call down a vast storm centered on a point you can see, and each round of maintained concentration unleashes escalating effects of thunder, acid, lightning, hail, and brutal winds.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.DRUID],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x211, 1),
          rangeKind: RANGE_KIND.SIGHT
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose a point you can see to center the storm.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Storm of Vengeance',
          description:
            'Creates an escalating storm effect that changes each round while concentration is maintained.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
