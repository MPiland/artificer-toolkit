import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SCALING_SOURCE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { creatureTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const prayerOfHealing: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PRAYER_OF_HEALING,
  label: 'Prayer of Healing',
  description: '<p>Up to six creatures you can see within range regain hit points, though the spell has no effect on undead or constructs.</p><p><strong>At Higher Levels.</strong> When you cast this spell using a spell slot of 3rd level or higher, the healing increases by 1d8 for each slot level above 2nd.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 2,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          maxTargets: 6,
          excludedCreatureTypeIds: [creatureTypeId('UNDEAD'), creatureTypeId('CONSTRUCT')]
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 1),
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 2), level: 2, order: 1, diceConfig: '2d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 3), level: 3, order: 2, diceConfig: '3d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 4), level: 4, order: 3, diceConfig: '4d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 5), level: 5, order: 4, diceConfig: '5d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 6), level: 6, order: 5, diceConfig: '6d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 7), level: 7, order: 6, diceConfig: '7d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 8), level: 8, order: 7, diceConfig: '8d8' },
                  { id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x212, 9), level: 9, order: 8, diceConfig: '9d8' }
                ],
                bonuses: [
                  {
                    id: spellChildId(SPELL_IDS.PRAYER_OF_HEALING, 0x213, 1),
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
