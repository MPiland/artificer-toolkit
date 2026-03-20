import {
  ACTIVATION_CODE,
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

export const hex: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HEX,
  label: 'Hex',
  description:
    'You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 necrotic damage to the target whenever you hit it with an attack. Also, choose one ability when you cast the spell. The target has disadvantage on ability checks made with the chosen ability.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.WARLOCK],
  magicSchoolId: schoolId('ENCHANTMENT'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.HEX, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HEX, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Curse one creature you can see within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.HEX, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.HEX, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Hex',
          description:
            'Curse the target, adding the spell\'s extra necrotic-damage rider to your hits and imposing disadvantage on checks with one chosen ability. This still needs a richer rider-damage, chosen-ability, and transfer-on-death model.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
