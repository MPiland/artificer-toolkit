import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SCALING_SOURCE, SHAPE_KIND, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { creatureTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const massCureWounds: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MASS_CURE_WOUNDS,
  label: 'Mass Cure Wounds',
  description: 'A wave of restorative energy heals up to six creatures of your choice in a 30-foot-radius sphere centered on a point within range, with no effect on undead or constructs.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: 'CHOSEN_CREATURES',
          maxTargets: 6,
          excludedCreatureTypeIds: [creatureTypeId('UNDEAD'), creatureTypeId('CONSTRUCT')]
        },
        shape: {
          id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 30,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 1),
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  { id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 2), level: 5, order: 1, diceConfig: '3d8' },
                  { id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 3), level: 6, order: 2, diceConfig: '4d8' },
                  { id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 4), level: 7, order: 3, diceConfig: '5d8' },
                  { id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 5), level: 8, order: 4, diceConfig: '6d8' },
                  { id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x213, 6), level: 9, order: 5, diceConfig: '7d8' }
                ],
                bonuses: [
                  {
                    id: spellChildId(SPELL_IDS.MASS_CURE_WOUNDS, 0x214, 1),
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
