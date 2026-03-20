import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
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

export const irresistibleDance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.IRRESISTIBLE_DANCE,
  label: 'Irresistible Dance',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    'One creature you can see starts dancing in place, burning its movement, suffering disadvantage on Dexterity saving throws and attack rolls, and giving other creatures advantage on attacks against it until it breaks free.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ENCHANTMENT'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x211, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Choose one creature you can see within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x214, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Irresistible Dance',
          description:
            'The target is compelled to dance under the spell’s rules until it breaks free or the spell ends.'
        },
        {
          id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x215, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Unaffected',
          description: 'A target that succeeds on the saving throw is unaffected by the spell.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
