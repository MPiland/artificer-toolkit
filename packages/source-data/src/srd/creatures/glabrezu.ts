import type { CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const glabrezu: CreatureAuthored = {
  id: S.CREATURE_IDS.GLABREZU,
  label: 'Glabrezu',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 15,
    CONSTITUTION: 21,
    INTELLIGENCE: 19,
    WISDOM: 17,
    CHARISMA: 16
  },
  naturalArmorBonus: 5,
  hitPoints: 157,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 15,
    die: 10,
    modifier: 75
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(142, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(142, 2, 'ABYSSAL')
  ],
  damageResistances: [
    'cold, fire, lightning; bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.truesight(120)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_9,
  xp: 5000,
  features: [
    {
      id: S.featureId(142, 1),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The glabrezu's spellcasting ability is Intelligence (spell save DC 16). The glabrezu can innately cast the following spells, requiring no material components: At will: darkness, detect magic, dispel magic 1/day each: confusion, fly, power word stun",
      grants: {
        spells: [
          {
            id: S.actionId(142, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DARKNESS, S.SPELL_IDS.DETECT_MAGIC, S.SPELL_IDS.DISPEL_MAGIC],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            spellSaveDc: 16,
            order: 0
          },
          ...([S.SPELL_IDS.CONFUSION, S.SPELL_IDS.FLY, S.SPELL_IDS.POWER_WORD_STUN] as const).map(
            (spellId, index) => ({
              id: S.actionId(142, 302 + index),
              grantKind: S.GRANT_KIND.SPELL_GRANT,
              selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: S.SCALING.NONE,
              authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
              spellIds: [spellId],
              attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
              castingAbility: S.ABILITY_CODE.INTELLIGENCE,
              spellSaveDc: 16,
              charges: {
                id: S.actionId(142, 402 + index),
                limitKind: 'FIXED_AMOUNT' as const,
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.DAILY,
                amount: 1
              },
              order: index + 1
            })
          )
        ]
      },
      order: 1
    },
    {
      id: S.featureId(142, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The glabrezu has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(142, 202),
      order: 2
    },
    {
      id: S.featureId(142, 3),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 3
    },
    {
      id: S.featureId(142, 4),
      label: 'Multiattack',
      description:
        'The glabrezu makes four attacks: two with its pincers and two with its fists. Alternatively, it makes two attacks with its pincers and casts one spell.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(142, 5) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(142, 6) }] }
            ]
          },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(142, 5) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(142, 5),
      label: 'Pincer',
      description:
        'Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 16 (2d10 + 5) bludgeoning damage. If the target is a Medium or smaller creature, it is grappled (escape DC 15). The glabrezu has two pincers, each of which can grapple only one target.',
      effects: [
        {
          id: S.actionId(142, 205),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(142, 1205),
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
              id: S.actionId(142, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(142, 207),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(142, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10+5'
                  },
                  S.grappledOutcome(142, {
                    localIndex: 1,
                    escapeDc: 15,
                    heldAtOnce: 2,
                    largestTarget: S.SIZE_CODE.MEDIUM
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(142, 6),
      label: 'Fist',
      description:
        'Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(142, 211),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(142, 1206),
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
              id: S.actionId(142, 212),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(142, 213),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(142, 214),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d4+2'
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
