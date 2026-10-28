import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
export const solar: CreatureAuthored = {
  id: S.CREATURE_IDS.SOLAR,
  label: 'Solar',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 26,
    DEXTERITY: 22,
    CONSTITUTION: 26,
    INTELLIGENCE: 25,
    WISDOM: 25,
    CHARISMA: 30
  },
  naturalArmorBonus: 5,
  hitPoints: 243,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 18,
    die: 10,
    modifier: 144
  },
  speeds: [...S.walk(50), ...S.fly(150)],
  proficiencies: [
    S.grantedSkillProficiency(256, 2, 'PERCEPTION'),
    S.grantedSaveProficiency(256, 1, 'INTELLIGENCE', 'WISDOM', 'CHARISMA')
  ],
  damageResistances: ['radiant', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
  senses: [S.truesight(120)],
  passivePerception: 24,
  challengeRatingId: S.CR.CR_21,
  xp: 33000,
  features: [
    {
      id: S.featureId(256, 6),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 0
    },
    {
      id: S.featureId(256, 1),
      label: 'Angelic Weapons',
      description:
        "Angelic Weapons. The solar's weapon attacks are magical. When the solar hits with any weapon, the weapon deals an extra 6d8 radiant damage (included in the attack).",
      grants: S.magicWeaponsGrants(256, 200),
      order: 1
    },
    {
      id: S.featureId(256, 2),
      label: 'Divine Awareness',
      description: 'Divine Awareness. The solar knows if it hears a lie.',
      effects: [
        {
          id: S.actionId(256, 202),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(256, 203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(256, 204),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(256, 205),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(256, 206),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Determine whether heard speech is a lie',
                    reasonCode: 'EXTERNAL_WORLD_STATE',
                    instructions: 'Divine Awareness. The solar knows if it hears a lie.'
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
      id: S.featureId(256, 3),
      label: 'Healing Touch (4/Day)',
      description:
        'Healing Touch (4/Day). The solar touches another creature. The target magically regains 40 (8d8 + 4) hit points and is freed from any curse, disease, poison, blindness, or deafness.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(256, 207),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 4
      },
      effects: [
        {
          id: S.actionId(256, 208),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(256, 209), rangeKind: S.RANGE_KIND.TOUCH },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              self: 'WARN'
            }
          },
          paths: [
            {
              id: S.actionId(256, 210),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(256, 211),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(256, 212),
                    effectKind: S.EFFECT_KIND.HEAL,
                    valueKind: 'DICE',
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '8d8+4'
                  },
                  {
                    id: S.actionId(256, 213),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_SOLAR_HEALING_TOUCH
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(256, 4),
      label: 'Greatsword',
      description:
        'Greatsword. Melee Weapon Attack: +15 to hit, reach 5 ft., one target. Hit: 22 (4d6 + 8) slashing damage plus 27 (6d8) radiant damage.',
      effects: [
        {
          id: S.actionId(8625, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(8625, 2),
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
              id: S.actionId(8625, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(8625, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(8625, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d6+8'
                  },
                  {
                    id: S.actionId(8625, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('RADIANT'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '6d8'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(256, 5),
      label: 'Slaying Longbow',
      description:
        'Slaying Longbow. Ranged Weapon Attack: +13 to hit, range 150/600 ft., one target. Hit: 15 (2d8 + 6) piercing damage plus 27 (6d8) radiant damage. If the target is a creature that has 100 hit points or fewer, it must succeed on a DC 15 Constitution saving throw or die.',
      effects: [
        {
          id: S.actionId(256, 214),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(256, 215),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 150,
              longAmount: 600,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(256, 216),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(256, 217),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(256, 218),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+6'
                  },
                  {
                    id: S.actionId(256, 219),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('RADIANT'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '6d8'
                  },
                  {
                    id: S.actionId(256, 220),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(256, 221),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 15
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      gate: { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 100 },
                      outcomes: [{ id: S.actionId(256, 222), effectKind: S.EFFECT_KIND.KILL }]
                    }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(256, 7),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The solar has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(256, 901),
      order: 6
    },
    {
      id: S.featureId(256, 8),
      label: 'Multiattack',
      description: 'Multiattack. The solar makes two greatsword attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(256, 4) }] }] }
        ]
      },
      order: 7
    },
    {
      id: S.featureId(256, 9),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The solar's spellcasting ability is Charisma (spell save DC 25). It can innately cast the following spells, requiring no material components: At will: detect evil and good, invisibility (self only) 3/day each: blade barrier, dispel evil and good, resurrection 1/day each: commune, control weather",
      grants: {
        spells: [
          {
            id: S.actionId(256, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_EVIL_AND_GOOD],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 25,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(256, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.INVISIBILITY],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 25,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, S.SPELL_GRANT_ATTRIBUTE.SELF_ONLY],
            order: 1
          },
          ...[
            [3, S.SPELL_IDS.BLADE_BARRIER],
            [3, S.SPELL_IDS.DISPEL_EVIL_AND_GOOD],
            [3, S.SPELL_IDS.RESURRECTION],
            [1, S.SPELL_IDS.COMMUNE],
            [1, S.SPELL_IDS.CONTROL_WEATHER]
          ].map(([perDay, spellId], index) => ({
            id: S.actionId(256, 710 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId as string],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 25,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(256, 720 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: perDay as number
            },
            order: index + 2
          }))
        ]
      },
      order: 8
    },
    {
      id: S.featureId(256, 10),
      label: 'Flying Sword',
      description:
        "Flying Sword. The solar releases its greatsword to hover magically in an unoccupied space within 5 feet of it. If the solar can see the sword, the solar can mentally command it as a bonus action to fly up to 50 feet and either make one attack against a target or return to the solar's hands. If the hovering sword is targeted by any effect, the solar is considered to be holding it. The hovering sword falls if the solar dies.",
      order: 9
    }
  ]
}
