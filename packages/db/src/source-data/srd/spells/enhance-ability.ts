import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const enhanceAbility: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ENHANCE_ABILITY,
  label: 'Enhance Ability',
  description:
    "You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until the spell ends. Bear's Endurance, Bull's Strength, Cat's Grace, Eagle's Splendor, Fox's Cunning, Owl's Wisdom.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.SORCERER],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING,
          detail: 'Touch one willing creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.ENHANCE_ABILITY, 0x213, 1),
            durationKind: 'HOUR',
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Enhance Ability',
          description:
            'The current model does not yet represent the selectable ability-specific modes, advantage on ability checks, or the related temporary hit point rider as structured outcomes.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
