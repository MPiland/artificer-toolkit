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
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const mageArmor: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MAGE_ARMOR,
  label: 'Mage Armor',
  description:
    'You touch a willing creature who isn\'t wearing armor, and a protective magical force surrounds it until the spell ends. The target\'s base AC becomes 13 + its Dexterity modifier.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.WARLOCK],
  magicSchoolId: schoolId('ABJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MAGE_ARMOR, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MAGE_ARMOR, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING,
          detail: 'Touch one willing creature that isn\'t wearing armor.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MAGE_ARMOR, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.MAGE_ARMOR, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 8
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Mage Armor',
          description:
            'The target\'s base AC becomes 13 + its Dexterity modifier until the spell ends, unless it dons armor before then.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
