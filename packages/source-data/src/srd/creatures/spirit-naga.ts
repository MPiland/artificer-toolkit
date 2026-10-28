import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const spiritNaga: CreatureAuthored = {
  id: S.CREATURE_IDS.SPIRIT_NAGA,
  label: 'Spirit Naga',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 17,
    CONSTITUTION: 14,
    INTELLIGENCE: 16,
    WISDOM: 15,
    CHARISMA: 16
  },
  naturalArmorBonus: 2,
  hitPoints: 75,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 10,
    die: 10,
    modifier: 20
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(259, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(259, 2, 'ABYSSAL', 'COMMON')
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(259, 1),
      label: 'Rejuvenation',
      description:
        'Rejuvenation. If it dies, the naga returns to life in 1d6 days and regains all its hit points. Only a wish spell can prevent this trait from functioning.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(259, 200),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(259, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Rejuvenation',
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            'When the naga dies, it returns to life in 1d6 days with all its hit points. Only a wish spell prevents this.'
        })
      ],
      order: 1
    },
    {
      id: S.featureId(259, 2),
      label: 'Spellcasting',
      description:
        'Spellcasting. The naga is a 10th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks), and it needs only verbal components to cast its spells. It has the following wizard spells prepared: Cantrips (at will): mage hand, minor illusion, ray of frost 1st level (4 slots): charm person, detect magic, sleep 2nd level (3 slots): detect thoughts, hold person 3rd level (3 slots): lightning bolt, water breathing 4th level (3 slots): blight, dimension door 5th level (2 slots): dominate person',
      grants: {
        spells: [
          {
            id: S.featureId(259, 220),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.MAGE_HAND, S.SPELL_IDS.MINOR_ILLUSION, S.SPELL_IDS.RAY_OF_FROST],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.PREPARED, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            spellSaveDc: 14,
            order: 0
          },
          ...[
            [1, 4, [S.SPELL_IDS.CHARM_PERSON, S.SPELL_IDS.DETECT_MAGIC, S.SPELL_IDS.SLEEP]],
            [2, 3, [S.SPELL_IDS.DETECT_THOUGHTS, S.SPELL_IDS.HOLD_PERSON]],
            [3, 3, [S.SPELL_IDS.LIGHTNING_BOLT, S.SPELL_IDS.WATER_BREATHING]],
            [4, 3, [S.SPELL_IDS.BLIGHT, S.SPELL_IDS.DIMENSION_DOOR]],
            [5, 2, [S.SPELL_IDS.DOMINATE_PERSON]]
          ].map(([level, slots, spellIds], index) => ({
            id: S.featureId(259, 221 + index),
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
            castingAbility: S.ABILITY_CODE.INTELLIGENCE,
            spellSaveDc: 14,
            charges: {
              id: S.featureId(259, 230 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: slots as number
            },
            order: index + 1
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(259, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +7 to hit, reach 10 ft., one creature. Hit: 7 (1d6 + 4) piercing damage, and the target must make a DC 13 Constitution saving throw, taking 31 (7d8) poison damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(259, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(259, 2),
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
              id: S.actionId(259, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(259, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(259, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(259, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(259, 205),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'IMMEDIATE',
                    savingThrow: {
                      id: S.actionId(259, 206),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 13
                    },
                    attempts: { kind: 'ONCE' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(259, 210),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '7d8'
                        }
                      ]
                    },
                    onSuccess: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(259, 214),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '7d8',
                          multiplier: 0.5
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
      order: 3
    }
  ]
}
