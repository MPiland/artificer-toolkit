import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const chillTouch: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CHILL_TOUCH,
  label: 'Chill Touch',
  description:
    'You create a ghostly skeletal hand in the space of a creature within range. Make a ranged spell attack; on a hit, the target takes 1d8 necrotic damage and cannot regain hit points until the start of your next turn.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.WARLOCK],
  magicSchoolId: schoolId('NECROMANCY'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Make a ranged spell attack against one creature within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x212, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('NECROTIC'),
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x212, 2), level: 1, order: 1, diceConfig: '1d8' },
            { id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x212, 3), level: 5, order: 2, diceConfig: '2d8' },
            { id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x212, 4), level: 11, order: 3, diceConfig: '3d8' },
            { id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x212, 5), level: 17, order: 4, diceConfig: '4d8' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.CHILL_TOUCH, 0x213, 1),
          branch: BRANCH.ON_MISS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Miss',
          description: 'On a miss, the hand fades with no effect.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
