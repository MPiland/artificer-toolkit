import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import * as S from './shared.js'

/** Deadly Leap's 3d6 + 4 of one damage type; `multiplier` halves it on a successful save. */
const leapDamage = (id: number, damageType: 'BLUDGEONING' | 'SLASHING', multiplier: number) => ({
  id: S.actionId(9521, id),
  effectKind: S.EFFECT_KIND.DAMAGE,
  damageTypeId: S.damageTypeId(damageType),
  valueKind: S.DAMAGE_VALUE_KIND.DICE,
  scalingKind: S.SCALING.NONE,
  diceConfig: '3d6',
  ...(multiplier === 1 ? {} : { multiplier }),
  bonuses: [
    {
      id: S.actionId(9521, id + 1),
      bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
      ability: S.ABILITY_CODE.STRENGTH,
      order: 1
    }
  ]
})

/** The parts of Deadly Leap no authored option carries (D187a), shown beside the save. */
const leapRuling = (id: number) => ({
  id: S.actionId(9521, id),
  effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
  label: 'Deadly Leap rulings',
  instructions:
    "The bulette must have jumped at least 15 feet this move. Each creature in its space chooses Strength or Dexterity for the DC 16 save; the save is authored as Strength, so the GM substitutes a Dexterity save for a creature that chooses it. On a success the creature is pushed 5 feet out of the bulette's space into an unoccupied space of its choice, or falls prone in the bulette's space if none is in range; the GM moves it.",
  reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
})
export const bulette: CreatureAuthored = {
  id: S.CREATURE_IDS.BULETTE,
  label: 'Bulette',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 11,
    CONSTITUTION: 21,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 5
  },
  naturalArmorBonus: 7,
  hitPoints: 94,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 9,
    die: 10,
    modifier: 45
  },
  speeds: [...S.walk(40), ...S.burrow(40)],
  proficiencies: [S.grantedSkillExpertise(57, 1, 'PERCEPTION')],
  senses: [S.darkvision(60), S.tremorsense(60)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(57, 1),
      label: 'Standing Leap',
      description:
        "Standing Leap. The bulette's long jump is up to 30 feet and its high jump is up to 15 feet, with or without a running start.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(57, 101),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(57, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_STANDING_LEAP
        })
      ],
      order: 1
    },
    {
      id: S.featureId(57, 2),
      label: 'Deadly Leap',
      description:
        "Deadly Leap. If the bulette jumps at least 15 feet as part of its movement, it can then use this action to land on its feet in a space that contains one or more other creatures. Each of those creatures must succeed on a DC 16 Strength or Dexterity saving throw (target's choice) or be knocked prone and take 14 (3d6 + 4) bludgeoning damage plus 14 (3d6 + 4) slashing damage. On a successful save, the creature takes only half the damage, isn't knocked prone, and is pushed 5 feet out of the bulette's space into an unoccupied space of the creature's choice. If no unoccupied space is within range, the creature instead falls prone in the bulette's space.",
      effects: [
        {
          id: S.actionId(9521, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(9521, 8),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 16
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(9521, 2),
              rangeKind: S.RANGE_KIND.SELF
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(9521, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9521, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  leapDamage(9, 'BLUDGEONING', 1),
                  leapDamage(12, 'SLASHING', 1),
                  {
                    id: S.actionId(9521, 15),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PRONE')
                  },
                  leapRuling(16)
                ]
              }
            },
            {
              id: S.actionId(9521, 17),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9521, 17) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  leapDamage(18, 'BLUDGEONING', 0.5),
                  leapDamage(21, 'SLASHING', 0.5),
                  leapRuling(24)
                ]
              }
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(57, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 30 (4d12 + 4) piercing damage.',
      effects: [
        {
          id: S.actionId(9521, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(9521, 5),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(9521, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9521, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(9521, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d12',
                    bonuses: [
                      {
                        id: S.actionId(9521, 7),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
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
      order: 3
    }
  ]
}
