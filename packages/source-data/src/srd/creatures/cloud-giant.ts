import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cloudGiant: CreatureAuthored = {
  id: S.CREATURE_IDS.CLOUD_GIANT,
  label: 'Cloud Giant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.HUGE,
  abilityScores: {
    STRENGTH: 27,
    DEXTERITY: 10,
    CONSTITUTION: 22,
    INTELLIGENCE: 12,
    WISDOM: 16,
    CHARISMA: 16
  },
  naturalArmorBonus: 4,
  hitPoints: 200,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 16,
    die: 12,
    modifier: 96
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(66, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(66, 2, 'INSIGHT', 'PERCEPTION'),
    S.grantedLanguageProficiency(66, 3, 'COMMON', 'GIANT')
  ],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_9,
  xp: 5000,
  features: [
    {
      id: S.featureId(66, 1),
      label: 'Keen Smell',
      description:
        'Keen Smell. The giant has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(66, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The giant's innate spellcasting ability is Charisma. It can innately cast the following spells, requiring no material components: At will: detect magic, fog cloud, light 3/day each: feather fall, fly, misty step, telekinesis 1/day each: control weather, gaseous form",
      grants: {
        spells: [
          {
            id: S.featureId(66, 201),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.LIGHT],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            order: 0
          },
          {
            id: S.featureId(66, 202),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_MAGIC, S.SPELL_IDS.FOG_CLOUD],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.KNOWN,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: 1,
            castingAbility: S.ABILITY_CODE.CHARISMA,
            order: 1
          },
          ...[
            [S.SPELL_IDS.FEATHER_FALL, 1],
            [S.SPELL_IDS.FLY, 3],
            [S.SPELL_IDS.MISTY_STEP, 2],
            [S.SPELL_IDS.TELEKINESIS, 5]
          ].map(([spellId, level], index) => ({
            id: S.featureId(66, 210 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId as string],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.KNOWN,
              S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: level as number,
            castingAbility: S.ABILITY_CODE.CHARISMA,
            charges: {
              id: S.featureId(66, 310 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: 3
            },
            order: 2 + index
          })),
          ...[
            [S.SPELL_IDS.CONTROL_WEATHER, 8],
            [S.SPELL_IDS.GASEOUS_FORM, 3]
          ].map(([spellId, level], index) => ({
            id: S.featureId(66, 220 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId as string],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.KNOWN,
              S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: level as number,
            castingAbility: S.ABILITY_CODE.CHARISMA,
            charges: {
              id: S.featureId(66, 320 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: 1
            },
            order: 6 + index
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(66, 3),
      label: 'Multiattack',
      description: 'The giant makes two morningstar attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(66, 4) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(66, 4),
      label: 'Morningstar',
      description:
        'Melee Weapon Attack: +12 to hit, reach 10 ft., one target. Hit: 21 (3d8 + 8) piercing damage.',
      effects: [
        {
          id: S.actionId(66, 105),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(66, 106),
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
              id: S.actionId(66, 107),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(66, 107)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(66, 108),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(66, 109),
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
      order: 4
    },
    {
      id: S.featureId(66, 5),
      label: 'Rock',
      description:
        'Ranged Weapon Attack: +12 to hit, range 60/240 ft., one target. Hit: 30 (4d10 + 8) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(66, 110),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(66, 111),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              longAmount: 240,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(66, 112),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(66, 112)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(66, 113),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10',
                    bonuses: [
                      {
                        id: S.actionId(66, 114),
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
      order: 5
    }
  ]
}
