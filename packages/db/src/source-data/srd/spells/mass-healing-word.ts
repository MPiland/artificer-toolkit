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
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { spellChildId } from './shared.js'

export const massHealingWord: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MASS_HEALING_WORD,
  label: 'Mass Healing Word',
  description:
    'As you call out words of restoration, up to six creatures of your choice that you can see within range regain hit points. This spell has no effect on undead or constructs.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.CLERIC],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: 'CHOSEN_CREATURES',
          maxTargets: 6,
          excludedCreatureTypeIds: ['undead', 'construct'],
          detail: 'Up to six creatures of your choice that you can see within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.HEAL,
          valueKind: 'DICE',
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 2), level: 3, order: 1, diceConfig: '1d4' },
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 3), level: 4, order: 2, diceConfig: '2d4' },
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 4), level: 5, order: 3, diceConfig: '3d4' },
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 5), level: 6, order: 4, diceConfig: '4d4' },
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 6), level: 7, order: 5, diceConfig: '5d4' },
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 7), level: 8, order: 6, diceConfig: '6d4' },
            { id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 8), level: 9, order: 7, diceConfig: '7d4' }
          ],
          bonuses: [
            {
              id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x213, 1),
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
  systemId: SRD_SYSTEM_ID
}
