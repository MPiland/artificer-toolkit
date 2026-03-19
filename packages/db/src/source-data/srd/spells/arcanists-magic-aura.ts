import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const arcanistsMagicAura: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ARCANISTS_MAGIC_AURA,
  label: "Arcanist's Magic Aura",
  description:
    'You place an illusion on a creature or object that you touch so divination spells reveal an aura of your choosing. Alternatively, you can make a nonmagical object appear magical or a magical object appear nonmagical.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ILLUSION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.ARCANISTS_MAGIC_AURA, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ARCANISTS_MAGIC_AURA, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch one creature or object and alter its magical aura.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.ARCANISTS_MAGIC_AURA, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.ARCANISTS_MAGIC_AURA, 0x213, 1),
            durationKind: DURATION_KIND.DAY,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: "Arcanist's Magic Aura",
          description:
            'The touched creature or object radiates the aura you choose for the duration, including appearing nonmagical or masking its actual magical aura.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
