import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const centaur: CreatureAuthored = {
  id: S.CREATURE_IDS.CENTAUR,
  label: 'Centaur',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 14,
    CONSTITUTION: 14,
    INTELLIGENCE: 9,
    WISDOM: 13,
    CHARISMA: 11,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 45,
  hitDice: '6d10+12',
  speeds: [...S.walk(50)],
  proficiencies: [
    S.grantedSkillProficiency(60, 1, 'ATHLETICS', 'PERCEPTION', 'SURVIVAL'),
    S.grantedLanguageProficiency(60, 2, 'ELVISH', 'SYLVAN')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(60, 1),
      label: 'Charge',
      description: 'Charge. If the centaur moves at least 30 feet straight toward a target and then hits it with a pike attack on the same turn, the target takes an extra 10 (3d6) piercing damage.',
      order: 1
    },
    {
      id: S.featureId(60, 2),
      label: 'Multiattack',
      description: 'Multiattack. The centaur makes two attacks: one with its pike and one with its hooves or two with its longbow.',
      order: 2
    },
    {
      id: S.featureId(60, 3),
      label: 'Pike',
      description: 'Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 9 (1d10 + 4) piercing damage.',
      capabilities: [
        {
          id: S.actionId(60, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(60, 5),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(60, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d10',
              bonuses: [
                {
                  id: S.actionId(60, 7),
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
      id: S.featureId(60, 4),
      label: 'Hooves',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
      capabilities: [
        {
          id: S.actionId(60, 8),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(60, 9),
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
              id: S.actionId(60, 10),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6',
              bonuses: [
                {
                  id: S.actionId(60, 11),
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
      id: S.featureId(60, 5),
      label: 'Longbow',
      description: 'Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
      capabilities: [
        {
          id: S.actionId(60, 12),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(60, 13),
              rangeKind: S.RANGE_KIND.SPECIAL
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(60, 14),
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
                  id: S.actionId(60, 15),
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
  ],
}
