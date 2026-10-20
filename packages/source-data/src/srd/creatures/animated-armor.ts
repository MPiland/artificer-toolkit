import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const animatedArmor: CreatureAuthored = {
  id: S.CREATURE_IDS.ANIMATED_ARMOR,
  label: 'Animated Armor',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 11,
    CONSTITUTION: 13,
    INTELLIGENCE: 1,
    WISDOM: 3,
    CHARISMA: 1
  },
  naturalArmorBonus: 8,
  hitPoints: 33,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 6,
    die: 8,
    modifier: 6
  },
  speeds: [...S.walk(25)],
  damageImmunities: ['poison', 'psychic'],
  conditionImmunities: [
    'blinded',
    'charmed',
    'deafened',
    'exhaustion',
    'frightened',
    'paralyzed',
    'petrified',
    'poisoned'
  ],
  senses: [S.blindsight(60, '(blind beyond this radius)')],
  passivePerception: 6,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(25, 1),
      label: 'Antimagic Susceptibility',
      description:
        "Antimagic Susceptibility. The armor is incapacitated while in the area of an antimagic field. If targeted by dispel magic, the armor must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute.",
      order: 1
    },
    {
      id: S.featureId(25, 2),
      label: 'False Appearance',
      description:
        'False Appearance. While the armor remains motionless, it is indistinguishable from a normal suit of armor.',
      order: 2
    },
    {
      id: S.featureId(25, 3),
      label: 'Multiattack',
      description: 'The armor makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(25, 4) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(25, 4),
      label: 'Slam',
      description:
        'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(25, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(25, 6),
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
              id: S.actionId(25, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(25, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(25, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(25, 8),
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
    }
  ]
}
