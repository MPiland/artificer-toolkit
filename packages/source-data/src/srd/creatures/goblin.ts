import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import { standingGrantedActionsEffect } from '../closed-rule-effect.js'
import * as S from './shared.js'

export const goblin: CreatureAuthored = {
  id: CREATURE_IDS.GOBLIN,
  label: 'Goblin',
  description: 'Small humanoid (goblinoid), neutral evil',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'SMALL',
  alignmentId: '00000000-0000-0000-0001-000800000000',
  tags: ['goblinoid'],
  abilityScores: {
    STRENGTH: 8,
    DEXTERITY: 14,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 8,
    CHARISMA: 8
  },
  naturalArmorBonus: 0,
  hitPoints: 7,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 2,
    die: 6,
    modifier: 0
  },
  speeds: walk(30),
  proficiencies: [
    S.grantedSkillExpertise(146, 3, 'STEALTH'),
    S.grantedLanguageProficiency(146, 2, 'COMMON', 'GOBLIN')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 9,
  challengeRatingId: CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(146, 1),
      label: 'Nimble Escape',
      description:
        'Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its turns.',
      effects: [
        standingGrantedActionsEffect({
          id: S.bonusActionId(146, 201),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(146, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          grantedActions: [
            {
              activation: S.ACTIVATION_CODE.BONUS_ACTION,
              actionDefinitionIds: [SRD_BASIC_ACTION_IDS.DISENGAGE, SRD_BASIC_ACTION_IDS.HIDE]
            }
          ]
        })
      ],
      order: 1
    },
    {
      id: S.featureId(146, 2),
      label: 'Scimitar',
      description:
        'Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
      effects: [
        {
          id: S.actionId(146, 202),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(146, 1202),
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
              id: S.actionId(146, 203),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(146, 204),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(146, 205),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
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
      order: 2
    },
    {
      id: S.featureId(146, 3),
      label: 'Shortbow',
      description:
        'Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(146, 206),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(146, 1203),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 80,
              longAmount: 320,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(146, 207),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(146, 208),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(146, 209),
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
      order: 3
    }
  ]
}
