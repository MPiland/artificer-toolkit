import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const kraken: CreatureAuthored = {
  id: S.CREATURE_IDS.KRAKEN,
  label: 'Kraken',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.GARGANTUAN,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 30,
    DEXTERITY: 11,
    CONSTITUTION: 25,
    INTELLIGENCE: 22,
    WISDOM: 18,
    CHARISMA: 20,
    SPELLCASTING: 0
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 472,
  hitDice: '27d20+189',
  speeds: [...S.swim(60)],
  proficiencies: [
    S.grantedSaveProficiency(9001, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(9001, 2, 'ATHLETICS', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(9001, 3, 'AQUAN')
  ],
  senses: ['truesight 120 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_23,
  xp: 50000,
  features: [
    {
      id: S.featureId(9001, 1),
      label: 'Amphibious',
      description: 'Amphibious. The kraken can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(9001, 2),
      label: 'Freedom of Movement',
      description: 'Freedom of Movement. The kraken ignores difficult terrain, and magical effects can\'t reduce its speed or cause it to be restrained. It can spend 5 feet of movement to escape from nonmagical restraints or being grappled.',
      order: 2
    },
    {
      id: S.featureId(9001, 3),
      label: 'Legendary Resistance (3/Day)',
      description: 'Legendary Resistance (3/Day). If the kraken fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(9001, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 3
    },
    {
      id: S.featureId(9001, 4),
      label: 'Siege Monster',
      description: 'Siege Monster. The kraken deals double damage to objects and structures.',
      order: 4
    },
    {
      id: S.featureId(9001, 5),
      label: 'Multiattack',
      description: 'The kraken makes three tentacle attacks, each of which it can replace with one bite attack against a creature grappled by it.',
      order: 5
    },
    {
      id: S.featureId(9001, 6),
      label: 'Tentacle',
      description: 'Tentacle. Melee Weapon Attack: +17 to hit, reach 30 ft., one target. Hit: 20 (3d6 + 10) bludgeoning damage, and the target is grappled (escape DC 18).',
      capabilities: [
        {
          id: S.actionId(9001, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(9001, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(9001, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d6',
              bonuses: [
                {
                  id: S.actionId(9001, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(9001, 7),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +17 to hit, reach 5 ft., one target grappled by the kraken. Hit: 23 (3d8 + 10) piercing damage.',
      capabilities: [
        {
          id: S.actionId(9001, 5),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(9001, 6),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(9001, 7),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d8',
              bonuses: [
                {
                  id: S.actionId(9001, 8),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 7
    },
    {
      id: S.featureId(9001, 8),
      label: 'Lightning Storm',
      description: 'Lightning Storm. The kraken magically creates three bolts of lightning, each of which can strike a point or creature it can see within 120 feet of it. Each creature within 5 feet of a lightning strike point must make a DC 23 Dexterity saving throw, taking 22 (4d10) lightning damage on a failed save, or half as much damage on a successful one.',
      order: 8
    }
  ]
}
