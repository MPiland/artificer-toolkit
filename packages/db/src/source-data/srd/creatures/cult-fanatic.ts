import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cultFanatic: CreatureAuthored = {
  id: S.CREATURE_IDS.CULT_FANATIC,
  label: 'Cult Fanatic',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
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
    CHARISMA: 14,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'leather armor',
  hitPoints: 33,
  hitDice: '6d8+6',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillProficiency(74, 1, 'DECEPTION', 'PERSUASION', 'RELIGION')
  ],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(74, 1),
      label: 'Dark Devotion',
      description: 'Dark Devotion. The fanatic has advantage on saving throws against being charmed or frightened.',
      order: 1
    },
    {
      id: S.featureId(74, 2),
      label: 'Spellcasting',
      description: 'Spellcasting. The fanatic is a 4th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 11, +3 to hit with spell attacks). The fanatic has the following cleric spells prepared: Cantrips (at will): light, sacred flame, thaumaturgy. 1st level (4 slots): command, inflict wounds, shield of faith. 2nd level (3 slots): hold person, spiritual weapon.',
      order: 2
    },
    {
      id: S.featureId(74, 3),
      label: 'Language Knowledge',
      description: 'Any one language (usually Common).',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(74, 2, 'COMMON')
        ]
      },
      order: 3
    },
    {
      id: S.featureId(74, 4),
      label: 'Multiattack',
      description: 'Multiattack. The fanatic makes two melee attacks.',
      order: 4
    },
    {
      id: S.featureId(74, 5),
      label: 'Dagger',
      description: 'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one creature. Hit: 4 (1d4 + 2) piercing damage.',
      capabilities: [
        {
          id: S.actionId(74, 4),
          order: 1,
          invocation: {
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
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(74, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
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
        },
        {
          id: S.actionId(74, 8),
          order: 2,
          invocation: {
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(74, 9),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(74, 10),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
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
      ],
      order: 5
    }
  ]
}
