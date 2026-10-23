import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import { standingGrantedActionsEffect } from '../closed-rule-effect.js'
import * as S from './shared.js'

export const spy: CreatureAuthored = {
  id: S.CREATURE_IDS.SPY,
  label: 'Spy',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 15,
    CONSTITUTION: 10,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 16
  },
  naturalArmorBonus: 0,
  hitPoints: 27,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 6,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(261, 2, 'INVESTIGATION', 'PERCEPTION'),
    S.grantedSkillProficiency(
      261,
      1,
      'DECEPTION',
      'INSIGHT',
      'PERSUASION',
      'SLEIGHT_OF_HAND',
      'STEALTH'
    )
  ],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(261, 1),
      label: 'Cunning Action',
      description:
        'Cunning Action. On each of its turns, the spy can use a bonus action to take the Dash, Disengage, or Hide action.',
      effects: [
        standingGrantedActionsEffect({
          id: S.actionId(261, 200),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(261, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          grantedActions: [
            {
              activation: S.ACTIVATION_CODE.BONUS_ACTION,
              actionDefinitionIds: [
                SRD_BASIC_ACTION_IDS.DASH,
                SRD_BASIC_ACTION_IDS.DISENGAGE,
                SRD_BASIC_ACTION_IDS.HIDE
              ]
            }
          ]
        })
      ],
      order: 1
    },
    {
      id: S.featureId(261, 2),
      label: 'Sneak Attack (1/Turn)',
      description:
        "Sneak Attack (1/Turn). The spy deals an extra 7 (2d6) damage when it hits a target with a weapon attack and has advantage on the attack roll, or when the target is within 5 feet of an ally of the spy that isn't incapacitated and the spy doesn't have disadvantage on the attack roll.",
      effects: S.sneakAttackEffects(261, 230, '2d6'),
      order: 2
    },
    {
      id: S.featureId(261, 3),
      label: 'Language Knowledge',
      description: 'any two languages',
      order: 3
    },
    {
      id: S.featureId(261, 4),
      label: 'Multiattack',
      description: 'The spy makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(261, 5) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(261, 5),
      label: 'Shortsword',
      description:
        'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(261, 206),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(261, 207),
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
              id: S.actionId(261, 208),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(261, 209),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(261, 210),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+2'
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
      id: S.featureId(261, 6),
      label: 'Hand Crossbow',
      description:
        'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(261, 211),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(261, 212),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              longAmount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(261, 213),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(261, 214),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(261, 215),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+2'
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
