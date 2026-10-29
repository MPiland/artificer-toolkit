import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import { indefiniteInvisibilityEffect } from './indefiniteInvisibility.js'
export const imp: CreatureAuthored = {
  id: S.CREATURE_IDS.IMP,
  label: 'Imp',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil', 'shapechanger'],
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 17,
    CONSTITUTION: 13,
    INTELLIGENCE: 11,
    WISDOM: 12,
    CHARISMA: 14
  },
  naturalArmorBonus: 0,
  hitPoints: 10,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 3,
    die: 4,
    modifier: 3
  },
  speeds: [...S.walk(20), ...S.fly(40)],
  proficiencies: [
    S.grantedSkillProficiency(173, 1, 'DECEPTION', 'INSIGHT', 'PERSUASION', 'STEALTH'),
    S.grantedLanguageProficiency(173, 2, 'INFERNAL', 'COMMON')
  ],
  damageResistances: [
    'cold',
    "bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(120)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(173, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. The imp can use its action to polymorph into a beast form that resembles a rat (speed 20 ft.), a raven (20 ft., fly 60 ft.), or a spider (20 ft., climb 20 ft.), or back into its true form. Its statistics are the same in each form, except for the speed changes noted. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(173, 201),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(173, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.BEAST_SPEED_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(173, 2),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the imp's darkvision.",
      order: 2
    },
    {
      id: S.featureId(173, 3),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The imp has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(173, 203),
      order: 3
    },
    {
      id: S.featureId(173, 4),
      label: 'Sting (Bite in Beast Form)',
      description:
        'Sting (Bite in Beast Form). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) piercing damage, and the target must make on a DC 11 Constitution saving throw, taking 10 (3d6) poison damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(173, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(173, 2),
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
              id: S.actionId(173, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(173, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(173, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(173, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(173, 220),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(173, 221),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 11
                    },
                    attempts: { kind: 'ONCE' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(173, 222),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '3d6'
                        }
                      ]
                    },
                    onSuccess: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(173, 223),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '3d6',
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
    },
    {
      id: S.featureId(173, 5),
      label: 'Invisibility',
      description:
        'The imp magically turns invisible until it attacks or until its concentration ends (as if concentrating on a spell). Any equipment the imp wears or carries is invisible with it.',
      effects: [
        indefiniteInvisibilityEffect({
          effectId: S.actionId(173, 6),
          rangeId: S.actionId(173, 7),
          pathId: S.actionId(173, 8),
          endTriggers: [
            { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_ATTACK_ROLL' }
          ]
        })
      ],
      order: 5
    }
  ]
}
