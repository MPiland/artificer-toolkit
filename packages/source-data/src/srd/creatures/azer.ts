import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const azer: CreatureAuthored = {
  id: S.CREATURE_IDS.AZER,
  label: 'Azer',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000400000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 12,
    CONSTITUTION: 15,
    INTELLIGENCE: 12,
    WISDOM: 13,
    CHARISMA: 10
  },
  naturalArmorBonus: 4,
  hitPoints: 39,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 6,
    die: 8,
    modifier: 12
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(33, 1, 'CONSTITUTION'),
    S.grantedLanguageProficiency(33, 2, 'IGNAN')
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(33, 1),
      label: 'Heated Body',
      description:
        'Heated Body. A creature that touches the azer or hits it with a melee attack while within 5 feet of it takes 5 (1d10) fire damage.',
      order: 1
    },
    {
      id: S.featureId(33, 2),
      label: 'Heated Weapons',
      description:
        'Heated Weapons. When the azer hits with a metal melee weapon, it deals an extra 3 (1d6) fire damage (included in the attack).',
      order: 2
    },
    {
      id: S.featureId(33, 3),
      label: 'Illumination',
      description:
        'Illumination. The azer sheds bright light in a 10-foot radius and dim light for an additional 10 feet.',
      order: 3
    },
    {
      id: S.featureId(33, 4),
      label: 'Warhammer',
      description:
        'Warhammer. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage, or 8 (1d10 + 3) bludgeoning damage if used with two hands to make a melee attack, plus 3 (1d6) fire damage.',
      effects: [
        {
          id: S.actionId(33, 2),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(33, 3),
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
              id: S.actionId(33, 4),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(33, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(33, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(33, 5),
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
              id: S.actionId(33, 6),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(33, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(33, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6'
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
