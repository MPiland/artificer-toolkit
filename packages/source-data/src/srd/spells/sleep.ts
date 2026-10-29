import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import {
  conditionTypeId,
  creatureTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const sleep: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SLEEP,
  label: 'Sleep',
  description:
    "<p>This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points (ignoring unconscious creatures). Starting with the creature that has the lowest current hit points, each creature affected by this spell falls unconscious until the spell ends, the sleeper takes damage, or someone uses an action to shake or slap the sleeper awake. Subtract each creature's hit points from the total before moving on to the creature with the next lowest hit points. A creature's hit points must be equal to or less than the remaining total for that creature to be affected. Undead and creatures immune to being charmed aren't affected by this spell. At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, roll an additional 2d8 for each slot level above 1st.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a pinch of fine sand, rose petals, or a cricket',
  magicSchoolId: schoolId('ENCHANTMENT'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SLEEP, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SLEEP, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          excludedCreatureTypeIds: [creatureTypeId('UNDEAD')],
          hitPointPool: { diceConfig: '5d8' },
          hitPointPoolIgnoredConditionIds: [conditionTypeId('UNCONSCIOUS')],
          hitPointPoolScaling: {
            scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
            breakpoints: Array.from({ length: 8 }, (_, index) => ({
              id: spellChildId(SPELL_IDS.SLEEP, 0x215, index + 1),
              level: index + 2,
              order: index + 1,
              value: { diceConfig: `${7 + index * 2}d8` }
            }))
          }
        },
        shape: {
          id: spellChildId(SPELL_IDS.SLEEP, 0x214, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SLEEP, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SLEEP, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SLEEP, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            lifecycle: {
              endTriggers: [
                { event: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const },
                {
                  event: 'ACTION_USED_ON_HOLDER' as const,
                  actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE]
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SLEEP, 0x212, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('UNCONSCIOUS')
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
