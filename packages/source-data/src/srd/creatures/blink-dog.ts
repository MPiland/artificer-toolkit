import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const blinkDog: CreatureAuthored = {
  id: S.CREATURE_IDS.BLINK_DOG,
  label: 'Blink Dog',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FEY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 17,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 4,
    die: 8,
    modifier: 4
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(48, 1, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(48, 2, 'BLINK_DOG')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(48, 1),
      label: 'Keen Hearing and Smell',
      description:
        'Keen Hearing and Smell. The dog has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
      order: 1
    },
    {
      id: S.featureId(48, 2),
      label: 'Language Limitation',
      description: "understands Sylvan but can't speak it",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(48, 3, 'SYLVAN')]
      },
      order: 2
    },
    {
      id: S.featureId(48, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) piercing damage.',
      effects: [
        {
          id: S.actionId(48, 3),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(48, 4),
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
              id: S.actionId(48, 5),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(48, 5) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(48, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(48, 6),
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
      order: 3
    },
    {
      id: S.featureId(48, 4),
      ruleDefinitionIds: [S.DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID],
      label: 'Teleport (Recharge 4-6)',
      description: 'Teleport (Recharge 4-6). The dog magically teleports,',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(48, 7),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(48, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(48, 9),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(48, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(48, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(48, 10),
                    effectKind: S.EFFECT_KIND.TELEPORT,
                    targetKind: 'SELF',
                    destinationKind: 'VISIBLE'
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
