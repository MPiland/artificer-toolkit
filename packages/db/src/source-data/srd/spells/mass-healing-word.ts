import { TARGET_DISPOSITION_KIND, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SCALING_SOURCE, SUBJECT, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { creatureTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const massHealingWord: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MASS_HEALING_WORD,
  label: 'Mass Healing Word',
  description: '<p>As you call out words of restoration, up to six creatures of your choice that you can see within range regain hit points. This spell has no effect on undead or constructs.</p><p><strong>At Higher Levels.</strong> When you cast this spell using a spell slot of 4th level or higher, the healing increases by 1d4 for each slot level above 3rd.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
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
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          maxTargets: 6,
          excludedCreatureTypeIds: [creatureTypeId('UNDEAD'), creatureTypeId('CONSTRUCT')]
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MASS_HEALING_WORD, 0x212, 1),
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
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
