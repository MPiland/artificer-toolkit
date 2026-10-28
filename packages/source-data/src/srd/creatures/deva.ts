import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import * as S from './shared.js'
export const deva: CreatureAuthored = {
  id: S.CREATURE_IDS.DEVA,
  label: 'Deva',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 18,
    CONSTITUTION: 18,
    INTELLIGENCE: 17,
    WISDOM: 20,
    CHARISMA: 20
  },
  naturalArmorBonus: 3,
  hitPoints: 136,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 16,
    die: 8,
    modifier: 64
  },
  speeds: [...S.walk(30), ...S.fly(90)],
  proficiencies: [
    S.grantedSaveProficiency(2916, 1, 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(2916, 2, 'INSIGHT', 'PERCEPTION')
  ],
  damageResistances: ['radiant', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened'],
  senses: [S.darkvision(120)],
  passivePerception: 19,
  challengeRatingId: S.CR.CR_10,
  xp: 5900,
  features: [
    {
      id: S.featureId(80, 8),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 0
    },
    {
      id: S.featureId(80, 1),
      label: 'Angelic Weapons',
      description:
        "Angelic Weapons. The deva's weapon attacks are magical. When the deva hits with any weapon, the weapon deals an extra 4d8 radiant damage (included in the attack).",
      grants: S.magicWeaponsGrants(80, 201),
      order: 1
    },
    {
      id: S.featureId(80, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The deva's spellcasting ability is Charisma (spell save DC 17). The deva can innately cast the following spells, requiring only verbal components: At will: detect evil and good 1/day each: commune, raise dead",
      grants: {
        spells: [
          {
            id: S.actionId(80, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DETECT_EVIL_AND_GOOD],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 17,
            order: 0
          },
          ...([S.SPELL_IDS.COMMUNE, S.SPELL_IDS.RAISE_DEAD] as const).map((spellId, index) => ({
            id: S.actionId(80, 302 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            spellSaveDc: 17,
            charges: {
              id: S.actionId(80, 402 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: index + 1
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(80, 3),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The deva has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(80, 203),
      order: 3
    },
    {
      id: S.featureId(80, 4),
      label: 'Multiattack',
      description: 'Multiattack. The deva makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(80, 5) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(80, 5),
      label: 'Mace',
      description:
        'Mace. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 4) bludgeoning damage plus 18 (4d8) radiant damage.',
      effects: [
        {
          id: S.actionId(2916, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2916, 2),
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
              id: S.actionId(2916, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2916, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2916, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(2916, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(2916, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2916, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2916, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('RADIANT'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8'
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
      id: S.featureId(80, 6),
      label: 'Healing Touch (3/Day)',
      description:
        'Healing Touch (3/Day). The deva touches another creature. The target magically regains 20 (4d8 + 2) hit points and is freed from any curse, disease, poison, blindness, or deafness.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(2916, 6),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      effects: [
        {
          id: S.actionId(2916, 7),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2916, 8),
              rangeKind: S.RANGE_KIND.TOUCH
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              self: 'WARN'
            }
          },
          paths: [
            {
              id: S.actionId(2916, 9),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2916, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(2916, 9),
                    effectKind: S.EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    amount: 20,
                    scalingKind: S.SCALING.NONE
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
      id: S.featureId(80, 7),
      label: 'Change Shape',
      description:
        "Change Shape. The deva magically polymorphs into a humanoid or beast that has a challenge rating equal to or less than its own, or back into its true form. It reverts to its true form if it dies. Any equipment it is wearing or carrying is absorbed or borne by the new form (the deva's choice). In a new form, the deva retains its game statistics and ability to speak, but its AC, movement modes, Strength, Dexterity, and special senses are replaced by those of the new form, and it gains any statistics and capabilities (except class features, legendary actions, and lair actions) that the new form has but that it lacks.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(80, 207),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(80, 1207), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.CR_CAPPED_FORM
        })
      ],
      order: 7
    }
  ]
}
