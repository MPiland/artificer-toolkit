import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

const ROAR_HEARING =
  'Only creatures able to hear the roar are affected; the GM ends the effect on any that cannot.'

export const androsphinx: CreatureAuthored = {
  id: S.CREATURE_IDS.ANDROSPHINX,
  label: 'Androsphinx',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000400000000',
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 10,
    CONSTITUTION: 20,
    INTELLIGENCE: 16,
    WISDOM: 18,
    CHARISMA: 23
  },
  naturalArmorBonus: 7,
  hitPoints: 199,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 19,
    die: 10,
    modifier: 95
  },
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillExpertise(24, 4, 'RELIGION'),
    S.grantedSaveProficiency(24, 1, 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM'),
    S.grantedSkillProficiency(24, 2, 'ARCANA', 'PERCEPTION'),
    S.grantedLanguageProficiency(24, 3, 'COMMON', 'SPHINX')
  ],
  damageImmunities: ['psychic', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  conditionImmunities: ['charmed', 'frightened'],
  senses: [S.truesight(120)],
  passivePerception: 20,
  challengeRatingId: S.CR.CR_17,
  xp: 18000,
  features: [
    {
      id: S.featureId(24, 1),
      label: 'Inscrutable',
      description:
        "Inscrutable. The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx's intentions or sincerity have disadvantage.",
      grants: S.inscrutableGrants(24, 1),
      order: 1
    },
    {
      id: S.featureId(24, 2),
      label: 'Magic Weapons',
      description: "Magic Weapons. The sphinx's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(24, 103),
      order: 2
    },
    {
      id: S.featureId(24, 7),
      label: 'Spellcasting',
      description:
        "Spellcasting. The sphinx is a 12th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 18, +10 to hit with spell attacks). It requires no material components to cast its spells. The sphinx has the following cleric spells prepared: Cantrips (at will): sacred flame, spare the dying, thaumaturgy 1st level (4 slots): command, detect evil and good, detect magic 2nd level (3 slots): lesser restoration, zone of truth 3rd level (3 slots): dispel magic, tongues 4th level (3 slots): banishment, freedom of movement 5th level (2 slots): flame strike, greater restoration 6th level (1 slot): heroes' feast",
      grants: {
        spells: [
          {
            id: S.actionId(24, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.SACRED_FLAME,
              S.SPELL_IDS.SPARE_THE_DYING,
              S.SPELL_IDS.THAUMATURGY
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.WISDOM,
            spellSaveDc: 18,
            order: 0
          },
          ...[
            [
              1,
              4,
              [S.SPELL_IDS.COMMAND, S.SPELL_IDS.DETECT_EVIL_AND_GOOD, S.SPELL_IDS.DETECT_MAGIC]
            ],
            [2, 3, [S.SPELL_IDS.LESSER_RESTORATION, S.SPELL_IDS.ZONE_OF_TRUTH]],
            [3, 3, [S.SPELL_IDS.DISPEL_MAGIC, S.SPELL_IDS.TONGUES]],
            [4, 3, [S.SPELL_IDS.BANISHMENT, S.SPELL_IDS.FREEDOM_OF_MOVEMENT]],
            [5, 2, [S.SPELL_IDS.FLAME_STRIKE, S.SPELL_IDS.GREATER_RESTORATION]],
            [6, 1, [S.SPELL_IDS.HEROES_FEAST]]
          ].map(([level, slots, spellIds], index) => ({
            id: S.actionId(24, 310 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: spellIds as string[],
            attributes: [
              S.SPELL_GRANT_ATTRIBUTE.PREPARED,
              S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
              S.SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: level as number,
            castingAbility: S.ABILITY_CODE.WISDOM,
            spellSaveDc: 18,
            charges: {
              id: S.actionId(24, 320 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: slots as number
            },
            order: index + 1
          }))
        ]
      },
      order: 3
    },
    {
      id: S.featureId(24, 3),
      label: 'Multiattack',
      description: 'Multiattack. The sphinx makes two claw attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(24, 4) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(24, 4),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +12 to hit, reach 5 ft., one target. Hit: 17 (2d10 + 6) slashing damage.',
      effects: [
        {
          id: S.actionId(24, 107),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(24, 108),
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
              id: S.actionId(24, 109),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(24, 109)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(24, 110),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(24, 111),
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
      order: 5
    },
    {
      id: S.featureId(24, 5),
      label: 'Roar (3/Day)',
      description:
        "Roar (3/Day). The sphinx emits a magical roar. Each time it roars before finishing a long rest, the roar is louder and the effect is different, as detailed below. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. First Roar. Each creature that fails a DC 18 Wisdom saving throw is frightened for 1 minute. A frightened creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Second Roar. Each creature that fails a DC 18 Wisdom saving throw is deafened and frightened for 1 minute. A frightened creature is paralyzed and can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Third Roar. Each creature makes a DC 18 Constitution saving throw. On a failed save, a creature takes 44 (8d10) thunder damage and is knocked prone. On a successful save, the creature takes half as much damage and isn't knocked prone.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(24, 30),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 3
      },
      effects: [
        {
          id: S.actionId(24, 112),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(24, 113),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 18
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(24, 114),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 500,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(24, 115),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(24, 115)}__result`,
                resultKind: 'SEQUENCE',
                duration: {
                  id: S.actionId(24, 116),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(24, 117),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  },
                  {
                    id: S.actionId(24, 118),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(24, 119),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                      baseDc: 18
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
                  },
                  {
                    id: S.actionId(24, 120),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'First roar',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions: `This is the sphinx's first roar since its last long rest. ${ROAR_HEARING}`
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(24, 121),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(24, 122),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 18
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(24, 123),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 500,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(24, 124),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(24, 124)}__result`,
                resultKind: 'SEQUENCE',
                duration: {
                  id: S.actionId(24, 125),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(24, 126),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('DEAFENED')
                  },
                  {
                    id: S.actionId(24, 127),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  },
                  {
                    id: S.actionId(24, 128),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PARALYZED')
                  },
                  {
                    id: S.actionId(24, 129),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(24, 130),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                      baseDc: 18
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
                  },
                  {
                    id: S.actionId(24, 131),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Second roar',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions: `This is the sphinx's second roar since its last long rest, after the first. ${ROAR_HEARING}`
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(24, 132),
          order: 3,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(24, 133),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 18
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(24, 134),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 500,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(24, 135),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(24, 135)}__result`,
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(24, 136),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('THUNDER'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '8d10'
                  },
                  {
                    id: S.actionId(24, 137),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PRONE')
                  },
                  {
                    id: S.actionId(24, 138),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Third roar',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions: `This is the sphinx's third roar since its last long rest, after the second. ${ROAR_HEARING}`
                  }
                ]
              }
            },
            {
              id: S.actionId(24, 139),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(24, 139)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(24, 140),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('THUNDER'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '8d10',
                    multiplier: 0.5
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
      id: S.featureId(24, 6),
      options: [
        {
          id: '00000000-0005-00c9-0070-001800000000',
          label: 'Claw Attack',
          description: 'The sphinx makes one claw attack.',
          order: 1,
          actionReference: { featureId: S.featureId(24, 4), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00ca-0070-001800000000',
          label: 'Teleport (Costs 2 Actions)',
          description:
            'The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.',
          order: 2,
          effects: [
            {
              id: '00000000-0005-0067-0070-001800000000',
              order: 2,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'FREE' },
                range: {
                  id: '00000000-0005-0068-0070-001800000000',
                  rangeKind: 'DISTANCE',
                  amount: 120,
                  unit: 'FEET'
                },
                targeting: { selectionKind: 'SELF' },
                resourceUse: { chargeId: S.legendaryActionId(24, 99), cost: 2 }
              },
              paths: [
                {
                  id: '00000000-0005-0069-0070-001800000000',
                  order: 1,
                  pathCode: 'ON_USE',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-0069-0070-001800000000__result',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: '00000000-0005-006a-0070-001800000000',
                        effectKind: 'TELEPORT',
                        targetKind: 'SELF',
                        destinationKind: 'VISIBLE'
                      }
                    ]
                  }
                }
              ]
            }
          ]
        },
        {
          id: '00000000-0005-00cb-0070-001800000000',
          label: 'Cast a Spell (Costs 3 Actions)',
          description:
            'The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.',
          order: 3
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      description:
        "The sphinx can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The sphinx regains spent legendary actions at the start of its turn. Claw Attack. The sphinx makes one claw attack. Teleport (Costs 2 Actions). The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see. Cast a Spell (Costs 3 Actions). The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.",
      charges: {
        id: S.legendaryActionId(24, 99),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 7
    }
  ]
}
