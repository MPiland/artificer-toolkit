import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const guardianNaga: CreatureAuthored = {
  id: S.CREATURE_IDS.GUARDIAN_NAGA,
  label: 'Guardian Naga',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 18,
    CONSTITUTION: 16,
    INTELLIGENCE: 16,
    WISDOM: 19,
    CHARISMA: 18
  },
  naturalArmorBonus: 4,
  hitPoints: 127,
  hitDice: {
    count: 15,
    die: 10,
    modifier: 45
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(
      156,
      1,
      'DEXTERITY',
      'CONSTITUTION',
      'INTELLIGENCE',
      'WISDOM',
      'CHARISMA'
    ),
    S.grantedLanguageProficiency(156, 2, 'CELESTIAL', 'COMMON')
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_10,
  xp: 5900,
  features: [
    {
      id: S.featureId(156, 1),
      label: 'Rejuvenation',
      description:
        'Rejuvenation. If it dies, the naga returns to life in 1d6 days and regains all its hit points. Only a wish spell can prevent this trait from functioning.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(156, 201),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(156, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GUARDIAN_NAGA_REJUVENATION
        })
      ],
      order: 1
    },
    {
      id: S.featureId(156, 2),
      label: 'Spellcasting',
      description:
        'Spellcasting. The naga is an 11th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 16, +8 to hit with spell attacks), and it needs only verbal components to cast its spells. It has the following cleric spells prepared: Cantrips (at will): mending, sacred flame, thaumaturgy 1st level (4 slots): command, cure wounds, shield of faith 2nd level (3 slots): calm emotions, hold person 3rd level (3 slots): bestow curse, clairvoyance 4th level (3 slots): banishment, freedom of movement 5th level (2 slots): flame strike, geas 6th level (1 slot): true seeing',
      grants: {
        spells: [
          {
            id: S.actionId(156, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.MENDING, S.SPELL_IDS.SACRED_FLAME, S.SPELL_IDS.THAUMATURGY],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.PREPARED, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.WISDOM,
            order: 0
          },
          {
            id: S.actionId(156, 302),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.COMMAND,
              S.SPELL_IDS.CURE_WOUNDS,
              S.SPELL_IDS.SHIELD_OF_FAITH,
              S.SPELL_IDS.CALM_EMOTIONS,
              S.SPELL_IDS.HOLD_PERSON,
              S.SPELL_IDS.BESTOW_CURSE,
              S.SPELL_IDS.CLAIRVOYANCE,
              S.SPELL_IDS.BANISHMENT,
              S.SPELL_IDS.FREEDOM_OF_MOVEMENT,
              S.SPELL_IDS.FLAME_STRIKE,
              S.SPELL_IDS.GEAS,
              S.SPELL_IDS.TRUE_SEEING
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.PREPARED],
            castingAbility: S.ABILITY_CODE.WISDOM,
            order: 1
          }
        ]
      },
      effects: [
        S.closedRuleEffect({
          id: S.actionId(156, 303),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: {
              id: S.actionId(156, 1303),
              rangeKind: S.RANGE_KIND.SELF
            },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GUARDIAN_NAGA_SPELLCASTING
        })
      ],
      order: 2
    },
    {
      id: S.featureId(156, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +8 to hit, reach 10 ft., one creature. Hit: 8 (1d8 + 4) piercing damage, and the target must make a DC 15 Constitution saving throw, taking 45 (10d8) poison damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(156, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(156, 2),
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
              id: S.actionId(156, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(156, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(156, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+4'
                  },
                  {
                    id: S.actionId(156, 220),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(156, 221),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 15
                    },
                    attempts: { kind: 'ONCE' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(156, 222),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '10d8'
                        }
                      ]
                    },
                    onSuccess: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(156, 223),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '10d8',
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
    },
    {
      id: S.featureId(156, 4),
      label: 'Spit Poison',
      description:
        'Spit Poison. Ranged Weapon Attack: +8 to hit, range 15/30 ft., one creature. Hit: The target must make a DC 15 Constitution saving throw, taking 45 (10d8) poison damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(156, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(156, 6),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              longAmount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(156, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(156, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(156, 230),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(156, 231),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 15
                    },
                    attempts: { kind: 'ONCE' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(156, 232),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '10d8'
                        }
                      ]
                    },
                    onSuccess: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(156, 233),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '10d8',
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
      order: 4
    }
  ]
}
