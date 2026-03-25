import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hobgoblin: CreatureAuthored = {
  id: S.CREATURE_IDS.HOBGOBLIN,
  label: 'Hobgoblin',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['goblinoid'],
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 9,
    SPELLCASTING: 0
  },
  armorClass: 18,
  armorClassNote: 'chain mail, shield',
  hitPoints: 11,
  hitDice: '2d8+2',
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedLanguageProficiency(165, 1, 'COMMON', 'GOBLIN')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(165, 1),
      label: 'Martial Advantage',
      description: "Martial Advantage. Once per turn, the hobgoblin can deal an extra 7 (2d6) damage to a creature it hits with a weapon attack if that creature is within 5 feet of an ally of the hobgoblin that isn't incapacitated.",
      order: 1
    },
    {
      id: S.featureId(165, 2),
      label: 'Longsword',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.',
      capabilities: [
        {
          id: S.actionId(165, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(165, 2),
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
              id: S.actionId(165, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(165, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(165, 3),
      label: 'Longbow',
      description: 'Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8 + 1) piercing damage.',
      capabilities: [
        {
          id: S.actionId(165, 5),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(165, 6), rangeKind: S.RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(165, 7),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(165, 8),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.DEXTERITY,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
