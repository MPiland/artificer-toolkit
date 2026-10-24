import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'

export const mummyLord: CreatureAuthored = {
  id: S.CREATURE_IDS.MUMMY_LORD,
  label: 'Mummy Lord',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 10,
    CONSTITUTION: 17,
    INTELLIGENCE: 11,
    WISDOM: 18,
    CHARISMA: 16
  },
  naturalArmorBonus: 7,
  hitPoints: 97,
  details: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 13,
    die: 8,
    modifier: 39
  },
  speeds: [...S.walk(20)],
  proficiencies: [
    S.grantedSaveProficiency(2129, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(2129, 2, 'HISTORY', 'RELIGION')
  ],
  damageVulnerabilities: ['fire'],
  damageImmunities: [
    'necrotic',
    'poison',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_15,
  xp: 13000,
  features: [
    {
      id: S.featureId(202, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The mummy lord has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(202, 501),
      order: 1
    },
    {
      id: S.featureId(202, 2),
      label: 'Rejuvenation',
      description:
        "Rejuvenation. A destroyed mummy lord gains a new body in 24 hours if its heart is intact, regaining all its hit points and becoming active again. The new body appears within 5 feet of the mummy lord's heart.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(202, 502),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(202, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MUMMY_LORD_REJUVENATION
        })
      ],
      order: 2
    },
    {
      id: S.featureId(202, 3),
      label: 'Spellcasting',
      description:
        'Spellcasting. The mummy lord is a 10th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 17, +9 to hit with spell attacks). The mummy lord has the following cleric spells prepared: Cantrips (at will): sacred flame, thaumaturgy 1st level (4 slots): command, guiding bolt, shield of faith 2nd level (3 slots): hold person, silence, spiritual weapon 3rd level (3 slots): animate dead, dispel magic 4th level (3 slots): divination, guardian of faith 5th level (2 slots): contagion, insect plague 6th level (1 slot): harm',
      grants: S.slottedSpellcastingGrants(
        202,
        S.ABILITY_CODE.WISDOM,
        [S.SPELL_IDS.SACRED_FLAME, S.SPELL_IDS.THAUMATURGY],
        [
          {
            level: 1,
            slots: 4,
            spellIds: [S.SPELL_IDS.COMMAND, S.SPELL_IDS.GUIDING_BOLT, S.SPELL_IDS.SHIELD_OF_FAITH]
          },
          {
            level: 2,
            slots: 3,
            spellIds: [S.SPELL_IDS.HOLD_PERSON, S.SPELL_IDS.SILENCE, S.SPELL_IDS.SPIRITUAL_WEAPON]
          },
          { level: 3, slots: 3, spellIds: [S.SPELL_IDS.ANIMATE_DEAD, S.SPELL_IDS.DISPEL_MAGIC] },
          { level: 4, slots: 3, spellIds: [S.SPELL_IDS.DIVINATION, S.SPELL_IDS.GUARDIAN_OF_FAITH] },
          { level: 5, slots: 2, spellIds: [S.SPELL_IDS.CONTAGION, S.SPELL_IDS.INSECT_PLAGUE] },
          { level: 6, slots: 1, spellIds: [S.SPELL_IDS.HARM] }
        ]
      ),
      order: 3
    },
    {
      id: S.featureId(202, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The mummy can use its Dreadful Glare and makes one attack with its rotting fist.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(202, 6) }],
                optional: true,
                comesFirst: true
              },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(202, 5) }] }
            ]
          }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(202, 5),
      label: 'Rotting Fist',
      description:
        "Rotting Fist. Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 14 (3d6 + 4) bludgeoning damage plus 21 (6d6) necrotic damage. If the target is a creature, it must succeed on a DC 16 Constitution saving throw or be cursed with mummy rot. The cursed target can't regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target's hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic.",
      effects: [
        {
          id: S.actionId(202, 504),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(202, 604),
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
              id: S.actionId(202, 804),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(202, 804) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(202, 940),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6',
                    bonuses: [
                      {
                        id: S.actionId(202, 990),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(202, 941),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '6d6'
                  },
                  {
                    id: S.actionId(202, 948),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Mummy Rot',
                    instructions:
                      "If the target is a creature, it must succeed on a DC 16 Constitution saving throw or be cursed with mummy rot. The cursed target can't regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target's hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic.",
                    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
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
      id: S.featureId(202, 6),
      label: 'Dreadful Glare',
      description:
        "Dreadful Glare. The mummy lord targets one creature it can see within 60 feet of it. If the target can see the mummy lord, it must succeed on a DC 16 Wisdom saving throw against this magic or become frightened until the end of the mummy's next turn. If the target fails the saving throw by 5 or more, it is also paralyzed for the same duration. A target that succeeds on the saving throw is immune to the Dreadful Glare of all mummies and mummy lords for the next 24 hours.",
      effects: [
        {
          id: S.actionId(202, 505),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: S.actionId(202, 605),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 16
            },
            range: {
              id: S.actionId(202, 606),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(202, 805),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(202, 805) + '__result',
                resultKind: 'SINGLE' as const,
                // Until the end of the mummy's next turn: one round counted on the source's turns.
                duration: {
                  id: S.actionId(202, 960),
                  durationKind: 'ROUND' as const,
                  amount: 1
                },
                lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
                // Failing by 5 or more also paralyzes it for the same duration.
                failureMarginRider: {
                  id: S.actionId(202, 961),
                  failedBy: 5,
                  outcomes: [
                    {
                      id: S.actionId(202, 962),
                      effectKind: S.EFFECT_KIND.CONDITION,
                      conditionId: conditionTypeId('PARALYZED')
                    }
                  ],
                  lifecycle: {}
                },
                outcomes: [
                  {
                    id: S.actionId(202, 950),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  }
                ]
              }
            },
            S.saveImmunityPath(202, 965)
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(202, 7),
      options: [
        {
          id: '00000000-0005-00c9-0070-00ca00000000',
          label: 'Attack',
          description:
            'The mummy lord makes one attack with its rotting fist or uses its Dreadful Glare.',
          order: 1
        },
        {
          id: '00000000-0005-00ca-0070-00ca00000000',
          label: 'Blinding Dust',
          description:
            "Blinding dust and sand swirls magically around the mummy lord. Each creature within 5 feet of the mummy lord must succeed on a DC 16 Constitution saving throw or be blinded until the end of the creature's next turn.",
          order: 2
        },
        {
          id: '00000000-0005-00cb-0070-00ca00000000',
          label: 'Blasphemous Word (Costs 2 Actions)',
          description:
            "The mummy lord utters a blasphemous word. Each non-undead creature within 10 feet of the mummy lord that can hear the magical utterance must succeed on a DC 16 Constitution saving throw or be stunned until the end of the mummy lord's next turn.",
          order: 3
        },
        {
          id: '00000000-0005-00cc-0070-00ca00000000',
          label: 'Channel Negative Energy (Costs 2 Actions)',
          description:
            "The mummy lord magically unleashes negative energy. Creatures within 60 feet of the mummy lord, including ones behind barriers and around corners, can't regain hit points until the end of the mummy lord's next turn.",
          order: 4
        },
        {
          id: '00000000-0005-00cd-0070-00ca00000000',
          label: 'Whirlwind of Sand (Costs 2 Actions)',
          description:
            'The mummy lord magically transforms into a whirlwind of sand, moves up to 60 feet, and reverts to its normal form.',
          order: 5
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      description:
        "The mummy lord can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The mummy lord regains spent legendary actions at the start of its turn. Attack. The mummy lord makes one attack with its rotting fist or uses its Dreadful Glare. Blinding Dust. Blinding dust and sand swirls magically around the mummy lord. Each creature within 5 feet of the mummy lord must succeed on a DC 16 Constitution saving throw or be blinded until the end of the creature's next turn. Blasphemous Word (Costs 2 Actions). The mummy lord utters a blasphemous word. Each non-undead creature within 10 feet of the mummy lord that can hear the magical utterance must succeed on a DC 16 Constitution saving throw or be stunned until the end of the mummy lord's next turn. Channel Negative Energy (Costs 2 Actions). The mummy lord magically unleashes negative energy. Creatures within 60 feet of the mummy lord, including ones behind barriers and around corners, can't regain hit points until the end of the mummy lord's next turn. Whirlwind of Sand (Costs 2 Actions). The mummy lord magically transforms into a whirlwind of sand, moves up to 60 feet, and reverts to its normal form. While in whirlwind form, the mummy lord is immune to all damage, and it can't be grappled, petrified, knocked prone, restrained, or stunned. Equipment worn or carried by the mummy lord remain in its possession.",
      charges: {
        id: S.legendaryActionId(202, 500),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 7
    }
  ]
}
