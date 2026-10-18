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
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const colorSpray: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.COLOR_SPRAY,
  label: 'Color Spray',
  description:
    "<p>A dazzling array of flashing, colored light springs from your hand. Roll 6d10; the total is how many hit points of creatures this spell can effect. Creatures in a 15-foot cone originating from you are affected in ascending order of their current hit points (ignoring unconscious creatures and creatures that can't see). Starting with the creature that has the lowest current hit points, each creature affected by this spell is blinded until the spell ends. Subtract each creature's hit points from the total before moving on to the creature with the next lowest hit points. A creature's hit points must be equal to or less than the remaining total for that creature to be affected. At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, roll an additional 2d10 for each slot level above 1st.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a pinch of powder or sand that is colored red, yellow, and blue',
  magicSchoolId: schoolId('ILLUSION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        shape: {
          id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x212, 1),
          shapeKind: SHAPE_KIND.CONE,
          length: {
            amount: 15,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          hitPointPool: { diceConfig: '6d10' },
          // A blinded creature is one that can't see.
          hitPointPoolIgnoredConditionIds: [
            conditionTypeId('UNCONSCIOUS'),
            conditionTypeId('BLINDED')
          ],
          hitPointPoolScaling: {
            scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
            breakpoints: Array.from({ length: 8 }, (_, index) => ({
              id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x215, index + 1),
              level: index + 2,
              order: index + 1,
              value: { diceConfig: `${8 + index * 2}d10` }
            }))
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            // The spell lasts 1 round: until the end of the caster's next turn.
            duration: {
              id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x214, 1),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: {
              turnAnchor: { actor: 'SOURCE' as const, boundary: 'END_OF_TURN' as const }
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.COLOR_SPRAY, 0x213, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('BLINDED')
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
