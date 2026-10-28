import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const planetar: CreatureAuthored = {
  id: S.CREATURE_IDS.PLANETAR,
  label: 'Planetar',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 24,
    DEXTERITY: 20,
    CONSTITUTION: 24,
    INTELLIGENCE: 19,
    WISDOM: 22,
    CHARISMA: 25
  },
  naturalArmorBonus: 4,
  hitPoints: 200,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 16,
    die: 10,
    modifier: 112
  },
  speeds: [...S.walk(40), ...S.fly(120)],
  proficiencies: [
    S.grantedSaveProficiency(220, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(220, 2, 'PERCEPTION')
  ],
  damageResistances: ['radiant; bludgeoning, piercing, and slashing from nonmagical attacks'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened'],
  senses: [S.truesight(120)],
  passivePerception: 21,
  challengeRatingId: S.CR.CR_16,
  xp: 15000,
  features: [
    {
      id: S.featureId(220, 1),
      label: 'Angelic Weapons',
      description:
        "Angelic Weapons. The planetar's weapon attacks are magical. When the planetar hits with any weapon, the weapon deals an extra 5d8 radiant damage (included in the attack).",
      grants: S.magicWeaponsGrants(220, 501),
      order: 1
    },
    {
      id: S.featureId(220, 2),
      label: 'Divine Awareness',
      description: 'Divine Awareness. The planetar knows if it hears a lie.',
      order: 2
    },
    {
      id: S.featureId(220, 3),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The planetar's spellcasting ability is Charisma (spell save DC 20). The planetar can innately cast the following spells, requiring no material components: At will: detect evil and good, invisibility (self only) 3/day each: blade barrier, dispel evil and good, flame strike, raise dead 1/day each: commune, control weather, insect plague",
      grants: {
        spells: [
          {
            id: S.actionId(220, 701),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_EVIL_AND_GOOD],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 20,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            order: 0
          },
          {
            id: S.actionId(220, 702),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.INVISIBILITY],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 20,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, S.SPELL_GRANT_ATTRIBUTE.SELF_ONLY],
            order: 1
          },
          {
            id: S.actionId(220, 703),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.BLADE_BARRIER,
              S.SPELL_IDS.DISPEL_EVIL_AND_GOOD,
              S.SPELL_IDS.FLAME_STRIKE,
              S.SPELL_IDS.RAISE_DEAD
            ],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 20,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(220, 704),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: 2
          },
          {
            id: S.actionId(220, 705),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.COMMUNE, S.SPELL_IDS.CONTROL_WEATHER, S.SPELL_IDS.INSECT_PLAGUE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 20,
            attributes: [S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            charges: {
              id: S.actionId(220, 706),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: 3
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(220, 4),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The planetar has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(220, 503),
      order: 4
    },
    {
      id: S.featureId(220, 5),
      label: 'Language Knowledge',
      description: 'all',
      order: 5
    },
    {
      id: S.featureId(220, 6),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 6
    },
    {
      id: S.featureId(220, 7),
      label: 'Multiattack',
      description: 'Multiattack. The planetar makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(220, 8) }] }] }
        ]
      },
      order: 7
    },
    {
      id: S.featureId(220, 8),
      label: 'Greatsword',
      description:
        'Melee Weapon Attack: +12 to hit, reach 5 ft., one target. Hit: 21 (4d6 + 7) slashing damage plus 22 (5d8) radiant damage.',
      effects: [
        {
          id: S.actionId(220, 2),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(220, 12),
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
              id: S.actionId(220, 13),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(220, 13) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(220, 13),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d6',
                    bonuses: [
                      {
                        id: S.actionId(220, 14),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(220, 15),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(220, 15) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(220, 15),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('RADIANT'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '5d8'
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
      id: S.featureId(220, 9),
      label: 'Healing Touch (4/Day)',
      description:
        'Healing Touch (4/Day). The planetar touches another creature. The target magically regains 30 (6d8 + 3) hit points and is freed from any curse, disease, poison, blindness, or deafness.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(220, 16),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 4
      },
      effects: [
        {
          id: S.actionId(220, 3),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(220, 17),
              rangeKind: S.RANGE_KIND.TOUCH
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              self: 'WARN'
            }
          },
          paths: [
            {
              id: S.actionId(220, 18),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(220, 18) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(220, 18),
                    effectKind: S.EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    amount: 30,
                    scalingKind: S.SCALING.NONE
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 9
    }
  ]
}
