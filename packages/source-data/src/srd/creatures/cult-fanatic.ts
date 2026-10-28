import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const cultFanatic: CreatureAuthored = {
  id: S.CREATURE_IDS.CULT_FANATIC,
  label: 'Cult Fanatic',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 14,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 14
  },
  naturalArmorBonus: 0,
  hitPoints: 33,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 6,
    die: 8,
    modifier: 6
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedSkillProficiency(74, 1, 'DECEPTION', 'PERSUASION', 'RELIGION')],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(74, 1),
      label: 'Dark Devotion',
      description:
        'Dark Devotion. The fanatic has advantage on saving throws against being charmed or frightened.',
      grants: S.advantageGrants(74, 1, { savesAgainst: ['CHARMED', 'FRIGHTENED'] }),
      order: 1
    },
    {
      id: S.featureId(74, 2),
      label: 'Spellcasting',
      description:
        'Spellcasting. The fanatic is a 4th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 11, +3 to hit with spell attacks). The fanatic has the following cleric spells prepared: Cantrips (at will): light, sacred flame, thaumaturgy 1st level (4 slots): command, inflict wounds, shield of faith 2nd level (3 slots): hold person, spiritual weapon',
      grants: S.slottedSpellcastingGrants(
        74,
        S.ABILITY_CODE.WISDOM,
        11,
        [S.SPELL_IDS.LIGHT, S.SPELL_IDS.SACRED_FLAME, S.SPELL_IDS.THAUMATURGY],
        [
          {
            level: 1,
            slots: 4,
            spellIds: [S.SPELL_IDS.COMMAND, S.SPELL_IDS.INFLICT_WOUNDS, S.SPELL_IDS.SHIELD_OF_FAITH]
          },
          { level: 2, slots: 3, spellIds: [S.SPELL_IDS.HOLD_PERSON, S.SPELL_IDS.SPIRITUAL_WEAPON] }
        ]
      ),
      order: 2
    },
    {
      id: S.featureId(74, 3),
      label: 'Language Knowledge',
      description: 'any one language (usually Common)',
      grants: {
        proficiencies: [S.grantedLanguageProficiency(74, 2, 'COMMON')]
      },
      order: 3
    },
    {
      id: S.featureId(74, 4),
      label: 'Multiattack',
      description: 'Multiattack. The fanatic makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(74, 5) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(74, 5),
      label: 'Dagger',
      description:
        'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one creature. Hit: 4 (1d4 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(74, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(74, 5),
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
              id: S.actionId(74, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(74, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(74, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(74, 7),
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
          id: S.actionId(74, 8),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(74, 9),
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
              id: S.actionId(74, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(74, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(74, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(74, 11),
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
      order: 5
    }
  ]
}
