import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const archmage: CreatureAuthored = {
  id: S.CREATURE_IDS.ARCHMAGE,
  label: 'Archmage',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 14,
    CONSTITUTION: 12,
    INTELLIGENCE: 20,
    WISDOM: 15,
    CHARISMA: 16
  },
  naturalArmorBonus: 0,
  hitPoints: 99,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 18,
    die: 8,
    modifier: 18
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(28, 3, 'ARCANA', 'HISTORY'),
    S.grantedSaveProficiency(28, 1, 'INTELLIGENCE', 'WISDOM')
  ],
  damageResistances: [
    'damage from spells; nonmagical bludgeoning, piercing, and slashing (from stoneskin)'
  ],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_12,
  xp: 8400,
  features: [
    {
      id: S.featureId(28, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The archmage has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(28, 101),
      order: 1
    },
    {
      id: S.featureId(28, 2),
      label: 'Spellcasting',
      description:
        'Spellcasting. The archmage is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 17, +9 to hit with spell attacks). The archmage can cast disguise self and invisibility at will and has the following wizard spells prepared: Cantrips (at will): fire bolt, light, mage hand, prestidigitation, shocking grasp 1st level (4 slots): detect magic, identify, mage armor,* magic missile 2nd level (3 slots): detect thoughts, mirror image, misty step 3rd level (3 slots): counterspell, fly, lightning bolt 4th level (3 slots): banishment, fire shield, stoneskin* 5th level (3 slots): cone of cold, scrying, wall of force 6th level (1 slot): globe of invulnerability 7th level (1 slot): teleport 8th level (1 slot): mind blank* 9th level (1 slot): time stop *The archmage casts these spells on itself before combat.',
      grants: {
        spells: [
          {
            id: S.featureId(28, 201),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.FIRE_BOLT,
              S.SPELL_IDS.LIGHT,
              S.SPELL_IDS.MAGE_HAND,
              S.SPELL_IDS.PRESTIDIGITATION,
              S.SPELL_IDS.SHOCKING_GRASP
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            order: 0
          },
          {
            id: S.featureId(28, 202),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DISGUISE_SELF],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.KNOWN,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: 1,
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            order: 1
          },
          {
            id: S.featureId(28, 203),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.INVISIBILITY],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.KNOWN,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: 2,
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            order: 2
          },
          ...[
            [
              1,
              4,
              [
                S.SPELL_IDS.DETECT_MAGIC,
                S.SPELL_IDS.IDENTIFY,
                S.SPELL_IDS.MAGE_ARMOR,
                S.SPELL_IDS.MAGIC_MISSILE
              ]
            ],
            [2, 3, [S.SPELL_IDS.DETECT_THOUGHTS, S.SPELL_IDS.MIRROR_IMAGE, S.SPELL_IDS.MISTY_STEP]],
            [3, 3, [S.SPELL_IDS.COUNTERSPELL, S.SPELL_IDS.FLY, S.SPELL_IDS.LIGHTNING_BOLT]],
            [4, 3, [S.SPELL_IDS.BANISHMENT, S.SPELL_IDS.FIRE_SHIELD, S.SPELL_IDS.STONESKIN]],
            [5, 3, [S.SPELL_IDS.CONE_OF_COLD, S.SPELL_IDS.SCRYING, S.SPELL_IDS.WALL_OF_FORCE]],
            [6, 1, [S.SPELL_IDS.GLOBE_OF_INVULNERABILITY]],
            [7, 1, [S.SPELL_IDS.TELEPORT]],
            [8, 1, [S.SPELL_IDS.MIND_BLANK]],
            [9, 1, [S.SPELL_IDS.TIME_STOP]]
          ].map(([level, slots, spellIds], index) => ({
            id: S.featureId(28, 210 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: spellIds as string[],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.PREPARED,
              S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: level as number,
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            charges: {
              id: S.featureId(28, 220 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: slots as number
            },
            order: index + 3
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(28, 3),
      label: 'Language Knowledge',
      description: 'any six languages',
      order: 3
    },
    {
      id: S.featureId(28, 4),
      label: 'Dagger',
      description:
        'Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(28, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(28, 2),
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
              id: S.actionId(28, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(28, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(28, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(28, 4),
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
        },
        {
          id: S.actionId(28, 5),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(28, 6),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 20,
              longAmount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(28, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(28, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(28, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(28, 8),
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
