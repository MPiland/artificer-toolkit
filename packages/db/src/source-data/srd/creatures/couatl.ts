import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const couatl: CreatureAuthored = {
  id: S.CREATURE_IDS.COUATL,
  label: 'Couatl',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 20,
    CONSTITUTION: 17,
    INTELLIGENCE: 18,
    WISDOM: 20,
    CHARISMA: 18,
    SPELLCASTING: 0
  },
  armorClass: 19,
  armorClassNote: 'natural armor',
  hitPoints: 97,
  hitDice: '13d8+39',
  speeds: [...S.walk(30), ...S.fly(90)],
  proficiencies: [
    S.grantedSaveProficiency(8048, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA')
  ],
  damageResistances: ['radiant'],
  damageImmunities: ['psychic', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  senses: ['truesight 120 ft.'],
  languages: ['all', 'telepathy 120 ft.'],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(8048, 1),
      label: 'Innate Spellcasting',
      description: "Innate Spellcasting. The couatl's spellcasting ability is Charisma (spell save DC 14). It can innately cast the following spells, requiring only verbal components: At will: detect evil and good, detect magic, detect thoughts. 3/day each: bless, create food and water, cure wounds, lesser restoration, protection from poison, sanctuary, shield. 1/day each: dream, greater restoration, scrying.",
      order: 1
    },
    {
      id: S.featureId(8048, 2),
      label: 'Magic Weapons',
      description: "Magic Weapons. The couatl's weapon attacks are magical.",
      order: 2
    },
    {
      id: S.featureId(8048, 3),
      label: 'Shielded Mind',
      description: 'Shielded Mind. The couatl is immune to scrying and to any effect that would sense its emotions, read its thoughts, or detect its location.',
      order: 3
    },
    {
      id: S.featureId(8048, 4),
      label: 'Bite',
      description: 'Melee Weapon Attack: +8 to hit, reach 5 ft., one creature. Hit: 8 (1d6 + 5) piercing damage, and the target must succeed on a DC 13 Constitution saving throw or be poisoned for 24 hours. Until this poison ends, the target is unconscious. Another creature can use an action to shake the target awake.',
      capabilities: [
        {
          id: S.actionId(8048, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(8048, 2),
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
              id: S.actionId(8048, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6',
              bonuses: [
                {
                  id: S.actionId(8048, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.DEXTERITY,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(8048, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              duration: {
                id: S.actionId(8048, 6),
                durationKind: DURATION_KIND.HOUR,
                amount: 24
              },
              conditionId: conditionTypeId('POISONED')
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(8048, 5),
      label: 'Constrict',
      description: "Melee Weapon Attack: +6 to hit, reach 10 ft., one Medium or smaller creature. Hit: 10 (2d6 + 3) bludgeoning damage, and the target is grappled (escape DC 15). Until this grapple ends, the target is restrained, and the couatl can't constrict another target.",
      capabilities: [
        {
          id: S.actionId(8048, 7),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(8048, 8),
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
              id: S.actionId(8048, 9),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6',
              bonuses: [
                {
                  id: S.actionId(8048, 10),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(8048, 11),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              conditionId: conditionTypeId('GRAPPLED')
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(8048, 6),
      label: 'Change Shape',
      description: 'Change Shape. The couatl magically polymorphs into a humanoid or beast that has a challenge rating equal to or less than its own, or back into its true form. It reverts to its true form if it dies. Any equipment it is wearing or carrying is absorbed or borne by the new form (the couatl\'s choice). In a new form, the couatl retains its game statistics and ability to speak, but its AC, movement modes, Strength, Dexterity, and other actions are replaced by those of the new form, and it gains any statistics and capabilities (except class features, legendary actions, and lair actions) that the new form has but that it lacks.',
      order: 6
    },
    {
      id: S.featureId(8048, 7),
      label: 'Divine Aid (2/Day)',
      description: 'Divine Aid (2/Day). The couatl casts bless, lesser restoration, or sanctuary, requiring no spell components and using the same spellcasting ability as Innate Spellcasting.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(8048, 12),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 2
      },
      capabilities: [
        {
          id: S.actionId(8048, 13),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.BONUS_ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(8048, 14),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(8048, 15),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
