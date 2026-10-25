import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  NUMERIC_EXPR_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { SRD_SPEEDS } from '../vocabulary.js'
const flySpeedId = SRD_SPEEDS.find((speed) => speed.code === 'FLY')?.id
if (!flySpeedId)
  throw new Error('SRD FLY speed vocabulary entry is required for Arcane Hand source data.')

const CLENCHED_FIST_EFFECT_ID = spellChildId(SPELL_IDS.ARCANE_HAND, 0x240, 1)

export const arcaneHand: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ARCANE_HAND,
  label: 'Arcane Hand',
  description:
    "<p>You create a Large hand of shimmering, translucent force in an unoccupied space that you can see within range. The hand lasts for the spell's duration, and it moves at your command, mimicking the movements of your own hand. The hand is an object that has AC 20 and hit points equal to your hit point maximum. If it drops to 0 hit points, the spell ends. It has a Strength of 26 (+8) and a Dexterity of 10 (+0). The hand doesn't fill its space. When you cast the spell and as a bonus action on your subsequent turns, you can move the hand up to 60 feet and then cause one of the following effects with it. Clenched Fist. The hand strikes one creature or object within 5 feet of it. Make a melee spell attack for the hand using your game statistics. On a hit, the target takes 4d8 force damage. Forceful Hand. The hand attempts to push a creature within 5 feet of it in a direction you choose. Make a check with the hand's Strength contested by the Strength (Athletics) check of the target. If the target is Medium or smaller, you have advantage on the check. If you succeed, the hand pushes the target up to 5 feet plus a number of feet equal to five times your spellcasting ability modifier. The hand moves with the target to remain within 5 feet of it. Grasping Hand. The hand attempts to grapple a Huge or smaller creature within 5 feet of it. You use the hand's Strength score to resolve the grapple. If the target is Medium or smaller, you have advantage on the check. While the hand is grappling the target, you can use a bonus action to have the hand crush it. When you do so, the target takes bludgeoning damage equal to 2d6 + your spellcasting ability modifier. Interposing Hand. The hand interposes itself between you and a creature you choose until you give the hand a different command. The hand moves to stay between you and the target, providing you with half cover against the target. The target can't move through the hand's space if its Strength score is less than or equal to the hand's Strength score. If its Strength score is higher than the hand's Strength score, the target can move toward you through the hand's space, but that space is difficult terrain for the target. At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the damage from the clenched fist option increases by 2d8 and the damage from the grasping hand increases by 2d6 for each slot level above 5th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'an eggshell and a snakeskin glove',
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            // The caster strikes with the hand's Clenched Fist, measured from it: free once on the
            // cast turn, then as a bonus action. Moving the hand, and the Forceful, Grasping and
            // Interposing hands (contested or cover from the hand's own Strength), are GM rulings
            // (D187a, D190a).
            lifecycle: {
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH' as const,
                  offeredTo: 'SOURCE' as const,
                  activation: ACTIVATION_CODE.BONUS_ACTION,
                  effectId: CLENCHED_FIST_EFFECT_ID,
                  target: 'INVOCATION' as const,
                  origin: 'CONJURED' as const,
                  castTurnUse: 'FREE_ONCE' as const
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                label: 'Arcane Hand',
                statBlock: {
                  size: SIZE_CODE.LARGE,
                  armorClass: {
                    kind: NUMERIC_EXPR_CODE.FIXED,
                    value: 20
                  },
                  hitPoints: {
                    kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM
                  },
                  speeds: [
                    {
                      speedId: flySpeedId,
                      amount: 60,
                      unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                  ],
                  abilityScores: {
                    STRENGTH: {
                      kind: NUMERIC_EXPR_CODE.FIXED,
                      value: 26
                    },
                    DEXTERITY: {
                      kind: NUMERIC_EXPR_CODE.FIXED,
                      value: 10
                    }
                  },
                  damageabilityKind: 'NORMAL',
                  // The hand doesn't fill its space.
                  occupiesSpace: false
                }
              },
              {
                id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x215, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {}
              }
            ]
          }
        }
      ]
    },
    {
      id: CLENCHED_FIST_EFFECT_ID,
      order: 2,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x241, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 5,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x244, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.ARCANE_HAND, 0x244, 1)}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x245, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FORCE'),
                valueKind: 'DICE' as const,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                // 4d8, and 2d8 more for each slot level above 5th.
                levels: Array.from({ length: 5 }, (_, index) => ({
                  id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x246, index + 1),
                  level: index + 5,
                  order: index + 1,
                  diceConfig: `${4 + 2 * index}d8`
                }))
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
