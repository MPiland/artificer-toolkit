import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const imprisonment: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.IMPRISONMENT,
  label: 'Imprisonment',
  description:
    'You create a magical restraint to hold a creature that you can see within range. The target must succeed on a Wisdom saving throw or be bound by the spell; if it succeeds, it is immune to this spell if you cast it again.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ABJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.IMPRISONMENT, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.IMPRISONMENT, 0x211, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.IMPRISONMENT, 0x212, 1),
          rangeKind: RANGE_KIND.SPECIAL
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Choose one creature you can see and bind it using one of the spell’s imprisonment forms.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.IMPRISONMENT, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Imprisoned',
          description:
            'On a failed save, the creature is bound by the chosen imprisonment form under the spell’s full SRD rules.'
        },
        {
          id: spellChildId(SPELL_IDS.IMPRISONMENT, 0x214, 1),
          branch: BRANCH.ON_SAVE_SUCCESS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Successful Save',
          description:
            'On a successful save, the target resists the spell and becomes immune to further castings of your imprisonment.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
