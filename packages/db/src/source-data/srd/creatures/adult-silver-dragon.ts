import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const adultSilverDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.ADULT_SILVER_DRAGON,
  label: 'Adult Silver Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 27,
    DEXTERITY: 10,
    CONSTITUTION: 25,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 21,
    SPELLCASTING: 0
  },
  armorClass: 19,
  armorClassNote: 'natural armor',
  hitPoints: 243,
  hitDice: '18d12+126',
  speeds: [...S.walk(40), ...S.fly(80)],
  proficiencies: [
    S.grantedSaveProficiency(11, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(11, 2, 'ARCANA', 'HISTORY', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(11, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['cold'],
  senses: ['blindsight 60 ft.', 'darkvision 120 ft.'],
  passivePerception: 21,
  challengeRatingId: S.CR.CR_16,
  xp: 15000,
  features: [
    {
      id: S.featureId(11, 1),
      label: 'Legendary Resistance (3/Day)',
      description: 'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(11, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 1
    },
    {
      id: S.featureId(11, 2),
      label: 'Multiattack',
      description: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
      capabilities: [
        {
          id: S.actionId(11, 10),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(11, 11), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.actionId(11, 12),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(11, 3),
      label: 'Bite',
      description: 'Melee Weapon Attack: +13 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage.',
      capabilities: [
        {
          id: S.actionId(11, 13),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 14),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            }
          },
          branches: [
            {
              id: S.actionId(11, 15),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d10',
              bonuses: [
                {
                  id: S.actionId(11, 16),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(11, 4),
      label: 'Claw',
      description: 'Melee Weapon Attack: +13 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.',
      capabilities: [
        {
          id: S.actionId(11, 17),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 18),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            }
          },
          branches: [
            {
              id: S.actionId(11, 19),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6',
              bonuses: [
                {
                  id: S.actionId(11, 20),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(11, 5),
      label: 'Tail',
      description: 'Melee Weapon Attack: +13 to hit, reach 15 ft., one target. Hit: 17 (2d8 + 8) bludgeoning damage.',
      capabilities: [
        {
          id: S.actionId(11, 21),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 22),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            }
          },
          branches: [
            {
              id: S.actionId(11, 23),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d8',
              bonuses: [
                {
                  id: S.actionId(11, 24),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(11, 6),
      label: 'Frightful Presence',
      description: "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 18 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
      capabilities: [
        {
          id: S.actionId(11, 25),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 26),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            }
          },
          branches: [
            {
              id: S.actionId(11, 27),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(11, 7),
      label: 'Breath Weapons (Recharge 5-6)',
      description: 'The dragon uses one of the following breath weapons.',
      capabilities: [
        {
          id: S.actionId(11, 28),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(11, 29), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.actionId(11, 30),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        }
      ],
      order: 7
    },
    {
      id: S.featureId(11, 8),
      label: 'Cold Breath (Recharge 5-6)',
      description: 'The dragon exhales an icy blast in a 60-foot cone. Each creature in that area must make a DC 20 Constitution saving throw, taking 58 (13d8) cold damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(11, 31),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(11, 32),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.CONSTITUTION
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(11, 33), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.actionId(11, 34),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '13d8'
            },
            {
              id: S.actionId(11, 35),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '13d8',
              saveSuccess: 'HALF'
            }
          ]
        }
      ],
      order: 8
    },
    {
      id: S.featureId(11, 9),
      label: 'Paralyzing Breath (Recharge 5-6)',
      description: 'The dragon exhales paralyzing gas in a 60-foot cone. Each creature in that area must succeed on a DC 20 Constitution saving throw or be paralyzed for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      capabilities: [
        {
          id: S.actionId(11, 36),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(11, 37),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.CONSTITUTION
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(11, 38), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.actionId(11, 39),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        }
      ],
      order: 9
    },
    {
      id: S.featureId(11, 10),
      label: 'Change Shape',
      description: "The dragon magically polymorphs into a humanoid or beast that has a challenge rating no higher than its own, or back into its true form. It reverts to its true form if it dies. Any equipment it is wearing or carrying is absorbed or borne by the new form (the dragon's choice). In a new form, the dragon retains its alignment, hit points, Hit Dice, ability to speak, proficiencies, Legendary Resistance, lair actions, and Intelligence, Wisdom, and Charisma scores, as well as this action. Its statistics and capabilities are otherwise replaced by those of the new form, except any class features, legendary actions, and lair actions of that form.",
      capabilities: [
        {
          id: S.actionId(11, 40),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(11, 41), rangeKind: S.RANGE_KIND.SELF }
          },
          branches: [
            {
              id: S.actionId(11, 42),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        }
      ],
      order: 10
    },
    {
      id: S.featureId(11, 11),
      label: 'Legendary Actions',
      description: "The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(11, 21),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      capabilities: [
        {
          id: S.legendaryActionId(11, 22),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.FREE },
            range: { id: S.legendaryActionId(11, 23), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.legendaryActionId(11, 24),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        },
        {
          id: S.legendaryActionId(11, 25),
          order: 2,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.FREE },
            range: { id: S.legendaryActionId(11, 26), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.legendaryActionId(11, 27),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        },
        {
          id: S.legendaryActionId(11, 28),
          order: 3,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.FREE },
            range: { id: S.legendaryActionId(11, 29), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          branches: [
            {
              id: S.legendaryActionId(11, 30),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE,
            }
          ]
        }
      ],
      order: 11
    }
  ]
}