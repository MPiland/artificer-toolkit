import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const rayOfFrost: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.RAY_OF_FROST,
  label: 'Ray of Frost',
  description:
    'A frigid beam of blue-white light streaks toward a creature within range. On a hit, it takes cold damage and its speed is reduced until the start of your next turn.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Hurl a frigid beam at one creature within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('COLD'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 2), level: 1, order: 1, diceConfig: '1d8' },
            { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 3), level: 5, order: 2, diceConfig: '2d8' },
            { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 4), level: 11, order: 3, diceConfig: '3d8' },
            { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 5), level: 17, order: 4, diceConfig: '4d8' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x213, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Rider',
          description: 'On a hit, the target\'s speed is reduced until the start of your next turn.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
