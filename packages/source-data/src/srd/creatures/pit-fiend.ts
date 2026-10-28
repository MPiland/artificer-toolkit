import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'

export const pitFiend: CreatureAuthored = {
  id: S.CREATURE_IDS.PIT_FIEND,
  label: 'Pit Fiend',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 26,
    DEXTERITY: 14,
    CONSTITUTION: 24,
    INTELLIGENCE: 22,
    WISDOM: 18,
    CHARISMA: 24
  },
  naturalArmorBonus: 7,
  hitPoints: 300,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 24,
    die: 10,
    modifier: 168
  },
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(8042, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM'),
    S.grantedLanguageProficiency(8042, 2, 'INFERNAL')
  ],
  damageResistances: [
    'cold',
    "bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.truesight(120)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_20,
  xp: 25000,
  features: [
    {
      id: S.featureId(219, 1),
      label: 'Fear Aura',
      description:
        "Fear Aura. Any creature hostile to the pit fiend that starts its turn within 20 feet of the pit fiend must make a DC 21 Wisdom saving throw, unless the pit fiend is incapacitated. On a failed save, the creature is frightened until the start of its next turn. If a creature's saving throw is successful, the creature is immune to the pit fiend's Fear Aura for the next 24 hours.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(219, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(219, 601),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 21
            },
            range: {
              id: S.actionId(219, 602),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 20,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.HOSTILE
            }
          },
          pathCode: S.PATH_CODE.ON_SAVE_FAIL,
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_PIT_FIEND_FEAR_AURA
        })
      ],
      order: 1
    },
    {
      id: S.featureId(219, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The pit fiend has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(219, 502),
      order: 2
    },
    {
      id: S.featureId(219, 3),
      label: 'Magic Weapons',
      description: "Magic Weapons. The pit fiend's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(219, 503),
      order: 3
    },
    {
      id: S.featureId(219, 4),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The pit fiend's spellcasting ability is Charisma (spell save DC 21). The pit fiend can innately cast the following spells, requiring no material components: At will: detect magic, fireball 3/day each: hold monster, wall of fire",
      grants: {
        spells: [
          {
            id: S.actionId(219, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_MAGIC, S.SPELL_IDS.FIREBALL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 21,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(219, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.HOLD_MONSTER, S.SPELL_IDS.WALL_OF_FIRE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 21,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(219, 703),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: 1
          }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(219, 5),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 5
    },
    {
      id: S.featureId(219, 6),
      label: 'Multiattack',
      description:
        'Multiattack. The pit fiend makes four attacks: one with its bite, one with its claw, one with its mace, and one with its tail.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(219, 7) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(219, 8) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(219, 9) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(219, 10) }] }
            ]
          }
        ]
      },
      order: 6
    },
    {
      id: S.featureId(219, 7),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 22 (4d6 + 8) piercing damage. The target must succeed on a DC 21 Constitution saving throw or become poisoned. While poisoned in this way, the target can't regain hit points, and it takes 21 (6d6) poison damage at the start of each of its turns. The poisoned target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.",
      effects: [
        {
          id: S.actionId(219, 505),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(219, 605),
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
              id: S.actionId(219, 805),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(219, 805) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(219, 950),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d6',
                    bonuses: [
                      {
                        id: S.actionId(219, 1000),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(219, 958),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Poison and healing denial',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      "A creature hit by the bite makes a DC 21 Constitution saving throw or is poisoned. While poisoned this way, it can't regain hit points and takes 21 (6d6) poison damage at the start of each of its turns. It can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success."
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    },
    {
      id: S.featureId(219, 8),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 17 (2d8 + 8) slashing damage.',
      effects: [
        {
          id: S.actionId(219, 506),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(219, 606),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(219, 806),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(219, 806) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(219, 960),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(219, 1010),
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
      order: 8
    },
    {
      id: S.featureId(219, 9),
      label: 'Mace',
      description:
        'Mace. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 15 (2d6 + 8) bludgeoning damage plus 21 (6d6) fire damage.',
      effects: [
        {
          id: S.actionId(219, 507),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(219, 607),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(219, 807),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(219, 807) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(219, 970),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(219, 1020),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(219, 971),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '6d6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 9
    },
    {
      id: S.featureId(219, 10),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 24 (3d10 + 8) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(219, 508),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(219, 608),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(219, 808),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(219, 808) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(219, 980),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d10',
                    bonuses: [
                      {
                        id: S.actionId(219, 1030),
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
      order: 10
    }
  ]
}
