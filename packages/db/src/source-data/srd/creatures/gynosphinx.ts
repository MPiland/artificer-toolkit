import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const gynosphinx: CreatureAuthored = {
  id: S.CREATURE_IDS.GYNOSPHINX,
  label: 'Gynosphinx',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000400000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 18,
    WISDOM: 18,
    CHARISMA: 18
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 136,
  hitDice: {
    count: 16,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillProficiency(3029, 1, 'ARCANA', 'HISTORY', 'PERCEPTION', 'RELIGION'),
    S.grantedLanguageProficiency(3029, 2, 'COMMON', 'SPHINX')
  ],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['psychic'],
  conditionImmunities: ['charmed', 'frightened'],
  senses: ['truesight 120 ft.'],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(157, 1),
      label: 'Inscrutable',
      description:
        "Inscrutable. The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx's intentions or sincerity have disadvantage.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(157, 201),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(157, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GYNOSPHINX_INSCRUTABLE
        })
      ],
      order: 1
    },
    {
      id: S.featureId(157, 2),
      label: 'Magic Weapons',
      description: "Magic Weapons. The sphinx's weapon attacks are magical.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(157, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(157, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_WEAPONS
        })
      ],
      order: 2
    },
    {
      id: S.featureId(157, 3),
      label: 'Spellcasting',
      description:
        'Spellcasting. The sphinx is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 16, +8 to hit with spell attacks). It requires no material components to cast its spells. The sphinx has the following wizard spells prepared: Cantrips (at will): mage hand, minor illusion, prestidigitation 1st level (4 slots): detect magic, identify, shield 2nd level (3 slots): darkness, locate object, suggestion 3rd level (3 slots): dispel magic, remove curse, tongues 4th level (3 slots): banishment, greater invisibility 5th level (1 slot): legend lore',
      grants: {
        spells: [
          {
            id: S.actionId(157, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.MAGE_HAND,
              S.SPELL_IDS.MINOR_ILLUSION,
              S.SPELL_IDS.PRESTIDIGITATION
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.PREPARED, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            order: 0
          },
          {
            id: S.actionId(157, 302),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.DETECT_MAGIC,
              S.SPELL_IDS.IDENTIFY,
              S.SPELL_IDS.SHIELD,
              S.SPELL_IDS.DARKNESS,
              S.SPELL_IDS.LOCATE_OBJECT,
              S.SPELL_IDS.SUGGESTION,
              S.SPELL_IDS.DISPEL_MAGIC,
              S.SPELL_IDS.REMOVE_CURSE,
              S.SPELL_IDS.TONGUES,
              S.SPELL_IDS.BANISHMENT,
              S.SPELL_IDS.GREATER_INVISIBILITY,
              S.SPELL_IDS.LEGEND_LORE
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.PREPARED],
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            order: 1
          }
        ]
      },
      effects: [
        S.closedRuleEffect({
          id: S.actionId(157, 303),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.SPELL_ATTACK,
            range: {
              id: S.actionId(157, 1303),
              rangeKind: S.RANGE_KIND.SELF
            },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GYNOSPHINX_SPELLCASTING
        })
      ],
      order: 3
    },
    {
      id: S.featureId(157, 4),
      label: 'Multiattack',
      description: 'Multiattack. The sphinx makes two claw attacks.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(157, 204),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(157, 1204), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GYNOSPHINX_MULTIATTACK
        })
      ],
      order: 4
    },
    {
      id: S.featureId(157, 5),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(157, 205),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(157, 1205),
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
              id: S.actionId(157, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(157, 207),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(157, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+4'
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
      id: S.featureId(157, 6),
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description:
        "The sphinx can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The sphinx regains spent legendary actions at the start of its turn. Claw Attack. The sphinx makes one claw attack. Teleport (Costs 2 Actions). The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see. Cast a Spell (Costs 3 Actions). The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.",
      effects: [
        S.closedRuleEffect({
          id: S.legendaryActionId(157, 209),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(157, 1206), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GYNOSPHINX_LEGENDARY_ACTIONS
        }),
        {
          id: S.legendaryActionId(157, 210),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 2 },
            range: {
              id: S.actionId(157, 1210),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.legendaryActionId(157, 211),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.legendaryActionId(157, 212),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.legendaryActionId(157, 213),
                    effectKind: S.EFFECT_KIND.TELEPORT,
                    targetKind: 'SELF',
                    destinationKind: 'VISIBLE'
                  }
                ]
              }
            }
          ]
        },
        S.closedRuleEffect({
          id: S.legendaryActionId(157, 214),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SPELL_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 3 },
            range: { id: S.actionId(157, 1214), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GYNOSPHINX_LEGENDARY_ACTIONS
        })
      ],
      order: 6
    }
  ]
}
