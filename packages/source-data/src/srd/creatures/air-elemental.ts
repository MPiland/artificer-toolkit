import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const airElemental: CreatureAuthored = {
  id: S.CREATURE_IDS.AIR_ELEMENTAL,
  label: 'Air Elemental',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  tags: ['hover'],
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 20,
    CONSTITUTION: 14,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 6
  },
  naturalArmorBonus: 0,
  hitPoints: 90,
  hitDice: {
    count: 12,
    die: 10,
    modifier: 24
  },
  speeds: [...S.walk(0), ...S.fly(90)],
  proficiencies: [S.grantedLanguageProficiency(6076, 1, 'AURAN')],
  damageResistances: [
    'lightning; thunder; bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['poison'],
  conditionImmunities: [
    'exhaustion',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained',
    'unconscious'
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(13, 1),
      label: 'Air Form',
      description:
        "Air Form. The elemental can enter a hostile creature's space and stop there. It can move through a space as narrow as 1 inch wide without squeezing.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(13, 101),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(13, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_AIR_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(13, 2),
      ruleDefinitionIds: [S.DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(13, 2)),
      label: 'Whirlwind (Recharge 4-6)',
      description:
        "Whirlwind (Recharge 4-6). Each creature in the elemental's space must make a DC 13 Strength saving throw. On a failure, a target takes 15 (3d8 + 2) bludgeoning damage and is flung up 20 feet away from the elemental in a random direction and knocked prone. If a thrown target strikes an object, such as a wall or floor, the target takes 3 (1d6) bludgeoning damage for every 10 feet it was thrown. If the target is thrown at another creature, that creature must succeed on a DC 13 Dexterity saving throw or take the same damage and be knocked prone. If the saving throw is successful, the target takes half the bludgeoning damage and isn't flung away or knocked prone.",
      effects: [
        {
          id: S.actionId(13, 103),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(13, 104),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 13
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(13, 105), rangeKind: S.RANGE_KIND.SELF },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(13, 106),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(13, 106)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(13, 107),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(13, 108),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(13, 109),
                    effectKind: S.EFFECT_KIND.FORCED_MOVEMENT,
                    direction: 'CHOICE',
                    actionEconomy: 'NONE',
                    distanceMode: 'FIXED_DISTANCE',
                    amount: 20,
                    unit: S.MEASUREMENT_UNIT_CODE.FEET
                  },
                  {
                    id: S.actionId(13, 110),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PRONE')
                  },
                  {
                    id: S.actionId(13, 111),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_AIR_ELEMENTAL_WHIRLWIND_COLLISION
                  }
                ]
              }
            },
            {
              id: S.actionId(13, 112),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(13, 112)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(13, 113),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    multiplier: 0.5,
                    bonuses: [
                      {
                        id: S.actionId(13, 114),
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
      order: 2
    },
    {
      id: S.featureId(13, 3),
      label: 'Multiattack',
      description: 'Multiattack. The elemental makes two slam attacks.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(13, 115),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(13, 116), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MULTIATTACK
        })
      ],
      order: 3
    },
    {
      id: S.featureId(13, 4),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(13, 117),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(13, 118),
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
              id: S.actionId(13, 119),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(13, 119)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(13, 120),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(13, 121),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
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
      order: 4
    }
  ]
}
