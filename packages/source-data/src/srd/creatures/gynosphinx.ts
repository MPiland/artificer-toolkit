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
  naturalArmorBonus: 5,
  hitPoints: 136,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 16,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillExpertise(3029, 3, 'ARCANA', 'HISTORY'),
    S.grantedSkillProficiency(3029, 1, 'PERCEPTION', 'RELIGION'),
    S.grantedLanguageProficiency(3029, 2, 'COMMON', 'SPHINX')
  ],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['psychic'],
  conditionImmunities: ['charmed', 'frightened'],
  senses: [S.truesight(120)],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(157, 1),
      label: 'Inscrutable',
      description:
        "Inscrutable. The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx's intentions or sincerity have disadvantage.",
      grants: S.inscrutableGrants(157, 1),
      order: 1
    },
    {
      id: S.featureId(157, 2),
      label: 'Magic Weapons',
      description: "Magic Weapons. The sphinx's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(157, 202),
      order: 2
    },
    {
      id: S.featureId(157, 3),
      label: 'Spellcasting',
      description:
        'Spellcasting. The sphinx is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 16, +8 to hit with spell attacks). It requires no material components to cast its spells. The sphinx has the following wizard spells prepared: Cantrips (at will): mage hand, minor illusion, prestidigitation 1st level (4 slots): detect magic, identify, shield 2nd level (3 slots): darkness, locate object, suggestion 3rd level (3 slots): dispel magic, remove curse, tongues 4th level (3 slots): banishment, greater invisibility 5th level (1 slot): legend lore',
      grants: S.slottedSpellcastingGrants(
        157,
        S.ABILITY_CODE.INTELLIGENCE,
        16,
        [S.SPELL_IDS.MAGE_HAND, S.SPELL_IDS.MINOR_ILLUSION, S.SPELL_IDS.PRESTIDIGITATION],
        [
          {
            level: 1,
            slots: 4,
            spellIds: [S.SPELL_IDS.DETECT_MAGIC, S.SPELL_IDS.IDENTIFY, S.SPELL_IDS.SHIELD]
          },
          {
            level: 2,
            slots: 3,
            spellIds: [S.SPELL_IDS.DARKNESS, S.SPELL_IDS.LOCATE_OBJECT, S.SPELL_IDS.SUGGESTION]
          },
          {
            level: 3,
            slots: 3,
            spellIds: [S.SPELL_IDS.DISPEL_MAGIC, S.SPELL_IDS.REMOVE_CURSE, S.SPELL_IDS.TONGUES]
          },
          {
            level: 4,
            slots: 3,
            spellIds: [S.SPELL_IDS.BANISHMENT, S.SPELL_IDS.GREATER_INVISIBILITY]
          },
          { level: 5, slots: 1, spellIds: [S.SPELL_IDS.LEGEND_LORE] }
        ]
      ),
      order: 3
    },
    {
      id: S.featureId(157, 4),
      label: 'Multiattack',
      description: 'Multiattack. The sphinx makes two claw attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(157, 5) }] }] }
        ]
      },
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
      options: [
        {
          id: '00000000-0005-00c9-0070-009d00000000',
          label: 'Claw Attack',
          description: 'The sphinx makes one claw attack.',
          order: 1,
          actionReference: { featureId: S.featureId(157, 5), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00ca-0070-009d00000000',
          label: 'Teleport (Costs 2 Actions)',
          description:
            'The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.',
          order: 2,
          effects: [
            {
              id: '00000000-0005-00d2-0070-009d00000000',
              order: 2,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'ACTION', amount: 2 },
                range: {
                  id: '00000000-0002-04ba-0070-009d00000000',
                  rangeKind: 'DISTANCE',
                  amount: 120,
                  unit: 'FEET'
                },
                targeting: { selectionKind: 'SELF' },
                resourceUse: { chargeId: S.legendaryActionId(157, 208), cost: 2 }
              },
              paths: [
                {
                  id: '00000000-0005-00d3-0070-009d00000000',
                  order: 1,
                  pathCode: 'ON_USE',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-00d4-0070-009d00000000',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: '00000000-0005-00d5-0070-009d00000000',
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
          id: '00000000-0005-00cb-0070-009d00000000',
          label: 'Cast a Spell (Costs 3 Actions)',
          description:
            'The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.',
          order: 3,
          effects: [
            {
              id: '00000000-0005-00d6-0070-009d00000000',
              order: 1,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'ACTION', amount: 3 },
                range: { id: '00000000-0002-04be-0070-009d00000000', rangeKind: 'SPECIAL' },
                resourceUse: { chargeId: S.legendaryActionId(157, 208), cost: 3 }
              },
              grantedSpellCast: { spellKind: 'LEVELED' },
              paths: []
            }
          ]
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      description:
        "The sphinx can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The sphinx regains spent legendary actions at the start of its turn. Claw Attack. The sphinx makes one claw attack. Teleport (Costs 2 Actions). The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see. Cast a Spell (Costs 3 Actions). The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.",
      charges: {
        id: S.legendaryActionId(157, 208),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 6
    }
  ]
}
