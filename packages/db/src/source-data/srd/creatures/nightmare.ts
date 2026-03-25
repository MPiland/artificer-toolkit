import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const nightmare: CreatureAuthored = {
  id: S.CREATURE_IDS.NIGHTMARE,
  label: 'Nightmare',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 15,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 68,
  hitDice: '8d10+24',
  speeds: [...S.walk(60), ...S.fly(90)],
  damageImmunities: ['fire'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(205, 1),
      label: 'Confer Fire Resistance',
      description: 'Confer Fire Resistance. The nightmare can grant resistance to fire damage to anyone riding it.',
      order: 1
    },
    {
      id: S.featureId(205, 2),
      label: 'Illumination',
      description: 'Illumination. The nightmare sheds bright light in a 10-foot radius and dim light for an additional 10 feet.',
      order: 2
    },
    {
      id: S.featureId(205, 3),
      label: 'Language Limitation',
      description: 'Understands Abyssal, Common, and Infernal but can\'t speak.',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(205, 1, 'INFERNAL', 'ABYSSAL', 'COMMON')
        ]
      },
      order: 3
    },
    {
      id: S.featureId(205, 4),
      label: 'Hooves',
      description: 'Hooves. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage plus 7 (2d6) fire damage.',
      capabilities: [
        {
          id: S.actionId(205, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(205, 2),
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
              id: S.actionId(205, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d8',
              bonuses: [
                {
                  id: S.actionId(205, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(205, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6'
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(205, 5),
      label: 'Ethereal Stride',
      description: 'Ethereal Stride. The nightmare and up to three willing creatures within 5 feet of it magically enter the Ethereal Plane from the Material Plane, or vice versa.',
      capabilities: [
        {
          id: S.actionId(205, 6),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(205, 7),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(205, 8),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.TELEPORT,
              targetKind: 'CHOSEN_CREATURES',
              destinationKind: 'SPECIAL',
              detail: 'The nightmare and up to three willing creatures within 5 feet of it magically enter the Ethereal Plane from the Material Plane, or vice versa.'
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
