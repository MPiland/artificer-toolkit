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

export const teleport: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TELEPORT,
  label: 'Teleport',
  description:
    'This spell instantly transports willing creatures or a single object to a destination you choose, with the outcome shaped by how familiar you are with the location.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.TELEPORT, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TELEPORT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          detail: 'Teleport yourself and willing creatures within 10 feet, or a single object that fits the spell limits.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.TELEPORT, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Teleport',
          description:
            'Transports willing creatures or one object to a chosen destination, with accuracy determined by your familiarity with that location and the spell\'s normal mishap table.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
