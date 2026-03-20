import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const findSteed: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FIND_STEED,
  label: 'Find Steed',
  description:
    'You summon a spirit that assumes the form of an unusually intelligent, strong, and loyal steed, creating a long-lasting bond with it.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.FIND_STEED, 0x201, 1),
    rangeKind: RANGE_KIND.SPECIAL
  },
  level: 2,
  classIds: [CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('CONJURATION'),
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FIND_STEED, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FIND_STEED, 0x211, 1),
          rangeKind: RANGE_KIND.SPECIAL
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Summon a steed spirit in an unoccupied space near you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FIND_STEED, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.CREATURE,
          label: 'Find Steed',
          detail:
            'Summons a loyal steed spirit that takes on an appropriate form and forms a lasting bond.'
        }
      ]
    }
  ]
}
