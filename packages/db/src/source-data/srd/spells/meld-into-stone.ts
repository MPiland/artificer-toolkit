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

export const meldIntoStone: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MELD_INTO_STONE,
  label: 'Meld into Stone',
  description:
    'You step into a stone object or surface large enough to fully contain your body, melding yourself and all the equipment you carry with the stone for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MELD_INTO_STONE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MELD_INTO_STONE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch a stone object or surface large enough to contain you.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MELD_INTO_STONE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MELD_INTO_STONE, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 8
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Meld into Stone',
          description:
            'Merges the target into stone for the duration. The full movement and sensory implications remain prose-bound.'
        }
      ]
    }
  ]
}
