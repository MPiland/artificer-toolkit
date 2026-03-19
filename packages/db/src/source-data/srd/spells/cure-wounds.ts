import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const cureWounds: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CURE_WOUNDS,
  label: "Cure Wounds",
  description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.PALADIN, CLASS_IDS.RANGER],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          excludedCreatureTypeIds: ['undead', 'construct'],
          detail: 'A creature you touch.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.HEAL,
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 2), level: 1, order: 1, diceConfig: '1d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 3), level: 2, order: 2, diceConfig: '2d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 4), level: 3, order: 3, diceConfig: '3d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 5), level: 4, order: 4, diceConfig: '4d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 6), level: 5, order: 5, diceConfig: '5d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 7), level: 6, order: 6, diceConfig: '6d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 8), level: 7, order: 7, diceConfig: '7d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 9), level: 8, order: 8, diceConfig: '8d8' },
            { id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x212, 10), level: 9, order: 9, diceConfig: '9d8' }
          ],
          bonuses: [
            {
              id: spellChildId(SPELL_IDS.CURE_WOUNDS, 0x213, 1),
              bonusKind: 'ABILITY_BONUS',
              ability: 'SPELLCASTING',
              order: 1
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
}
