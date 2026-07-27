import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const erinyes: CreatureAuthored = {
  id: S.CREATURE_IDS.ERINYES,
  label: 'Erinyes',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 16,
    CONSTITUTION: 18,
    INTELLIGENCE: 14,
    WISDOM: 14,
    CHARISMA: 18
  },
  armorClass: 18,
  armorClassNote: 'plate',
  hitPoints: 153,
  hitDice: {
    count: 18,
    die: 8,
    modifier: 72
  },
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(98, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(98, 2, 'INFERNAL')
  ],
  damageResistances: [
    "cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['truesight 120 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_12,
  xp: 8400,
  features: [
    {
      id: S.featureId(98, 1),
      label: 'Hellish Weapons',
      description:
        "Hellish Weapons. The erinyes's weapon attacks are magical and deal an extra 13 (3d8) poison damage on a hit (included in the attacks).",
      order: 1
    },
    {
      id: S.featureId(98, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The erinyes has advantage on saving throws against spells and other magical effects.',
      order: 2
    },
    {
      id: S.featureId(98, 3),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 3
    },
    {
      id: S.featureId(98, 4),
      label: 'Multiattack',
      description: 'The erinyes makes three attacks.',
      effects: [
        {
          id: S.actionId(98, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(98, 5), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          paths: [
            {
              id: S.actionId(98, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(98, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(98, 6),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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
      id: S.featureId(98, 5),
      label: 'Longsword',
      description:
        'Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing damage, or 9 (1d10 + 4) slashing damage if used with two hands, plus 13 (3d8) poison damage.',
      effects: [
        {
          id: S.actionId(98, 7),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(98, 8), rangeKind: S.RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(98, 9),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(98, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(98, 9),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(98, 6),
      label: 'Longbow',
      description:
        'Ranged Weapon Attack: +7 to hit, range 150/600 ft., one target. Hit: 7 (1d8 + 3) piercing damage plus 13 (3d8) poison damage, and the target must succeed on a DC 14 Constitution saving throw or be poisoned. The poison lasts until it is removed by the lesser restoration spell or similar magic.',
      effects: [
        {
          id: S.actionId(98, 10),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(98, 11),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 150,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(98, 12),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(98, 12) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(98, 12),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(98, 13),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(98, 14),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(98, 14) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(98, 14),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('POISON'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(98, 15),
              order: 3,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(98, 15) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(98, 15),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(98, 7),
      label: 'Parry',
      description:
        'The erinyes adds 4 to its AC against one melee attack that would hit it. To do so, the erinyes must see the attacker and be wielding a melee weapon.',
      effects: [
        {
          id: S.reactionId(98, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: S.reactionId(98, 2), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          paths: [
            {
              id: S.reactionId(98, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.reactionId(98, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.reactionId(98, 3),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
