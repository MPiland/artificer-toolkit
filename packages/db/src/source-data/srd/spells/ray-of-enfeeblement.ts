import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
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

export const rayOfEnfeeblement: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.RAY_OF_ENFEEBLEMENT,
  label: 'Ray of Enfeeblement',
  description:
    'A black beam of enervating energy springs from your finger toward a creature within range. On a hit, the target deals only half damage with Strength-based weapon attacks until the spell ends.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('NECROMANCY'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.RAY_OF_ENFEEBLEMENT, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.RAY_OF_ENFEEBLEMENT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Send the ray at one creature within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.RAY_OF_ENFEEBLEMENT, 0x212, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Rider',
          description:
            'On a hit, the target deals only half damage with Strength-based weapon attacks until the spell ends.'
        },
        {
          id: spellChildId(SPELL_IDS.RAY_OF_ENFEEBLEMENT, 0x213, 1),
          branch: BRANCH.ON_MISS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Miss',
          description: 'On a miss, the spell has no effect.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
