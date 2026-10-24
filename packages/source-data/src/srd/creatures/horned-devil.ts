import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hornedDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.HORNED_DEVIL,
  label: 'Horned Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 17,
    CONSTITUTION: 21,
    INTELLIGENCE: 12,
    WISDOM: 16,
    CHARISMA: 17
  },
  naturalArmorBonus: 5,
  hitPoints: 178,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 17,
    die: 10,
    modifier: 85
  },
  speeds: [...S.walk(20), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(9677, 1, 'STRENGTH', 'DEXTERITY', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(9677, 2, 'INFERNAL')
  ],
  damageResistances: [
    'cold; bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(120)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(167, 7),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 0
    },
    {
      id: S.featureId(167, 1),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 1
    },
    {
      id: S.featureId(167, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(167, 202),
      order: 2
    },
    {
      id: S.featureId(167, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The devil makes three melee attacks: two with its fork and one with its tail. It can use Hurl Flame in place of any melee attack.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 2,
                fillers: [
                  { kind: 'FEATURE', featureId: S.featureId(167, 4) },
                  { kind: 'FEATURE', featureId: S.featureId(167, 6) }
                ]
              },
              {
                count: 1,
                fillers: [
                  { kind: 'FEATURE', featureId: S.featureId(167, 5) },
                  { kind: 'FEATURE', featureId: S.featureId(167, 6) }
                ]
              }
            ]
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(167, 4),
      label: 'Fork',
      description:
        'Fork. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 15 (2d8 + 6) piercing damage.',
      effects: [
        {
          id: S.actionId(167, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(167, 1204),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(167, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(167, 206),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(167, 207),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+6'
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
      id: S.featureId(167, 5),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 10 (1d8 + 6) piercing damage. If the target is a creature other than an undead or a construct, it must succeed on a DC 17 Constitution saving throw or lose 10 (3d6) hit points at the start of each of its turns due to an infernal wound. Each time the devil hits the wounded target with this attack, the damage dealt by the wound increases by 10 (3d6). Any creature can take an action to stanch the wound with a successful DC 12 Wisdom (Medicine) check. The wound also closes if the target receives magical healing.',
      effects: [
        {
          id: S.actionId(167, 208),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(167, 1206),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(167, 209),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(167, 210),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(167, 211),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+6'
                  },
                  {
                    id: S.actionId(167, 220),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(167, 221),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 17
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SEQUENCE',
                      outcomes: [
                        {
                          id: S.actionId(167, 222),
                          effectKind: S.EFFECT_KIND.FOLLOW_UP_CHECK,
                          label: 'stanch the wound',
                          activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                          ability: S.ABILITY_CODE.WISDOM,
                          fixedDc: 12,
                          skillId: S.skillId('MEDICINE'),
                          actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'],
                          repeatable: true,
                          onSuccess: { kind: 'END' },
                          onFailure: { kind: 'CONTINUE' }
                        },
                        {
                          id: S.actionId(167, 223),
                          effectKind: S.EFFECT_KIND.CLOSED_RULE,
                          ruleKind: S.CLOSED_RULE_KIND.CREATURE_HORNED_DEVIL_INFERNAL_WOUND
                        }
                      ]
                    }
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
      id: S.featureId(167, 6),
      label: 'Hurl Flame',
      description:
        "Hurl Flame. Ranged Spell Attack: +7 to hit, range 150 ft., one target. Hit: 14 (4d6) fire damage. If the target is a flammable object that isn't being worn or carried, it also catches fire.",
      effects: [
        {
          id: S.actionId(167, 215),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_SPELL_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(167, 1207),
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
              id: S.actionId(167, 216),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(167, 217),
                resultKind: 'SINGLE',
                // Setting an unattended flammable object alight stays description-only: an
                // Encounter's targets are creatures.
                outcomes: [
                  {
                    id: S.actionId(167, 218),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
