import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const giantOctopus: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_OCTOPUS,
  label: 'Giant Octopus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 13,
    CONSTITUTION: 13,
    INTELLIGENCE: 4,
    WISDOM: 10,
    CHARISMA: 4
  },
  armorClass: 11,
  hitPoints: 52,
  hitDice: {
    count: 8,
    die: 10,
    modifier: 8
  },
  speeds: [...S.walk(10), ...S.swim(60)],
  proficiencies: [S.grantedSkillProficiency(3505, 1, 'PERCEPTION', 'STEALTH')],
  senses: ['darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(128, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. While out of water, the octopus can hold its breath for 1 hour.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(128, 201),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(128, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_HOLD_BREATH
        })
      ],
      order: 1
    },
    {
      id: S.featureId(128, 2),
      label: 'Underwater Camouflage',
      description:
        'Underwater Camouflage. The octopus has advantage on Dexterity (Stealth) checks made while underwater.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(128, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(128, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_UNDERWATER_CAMOUFLAGE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(128, 3),
      label: 'Tentacles',
      description:
        "Tentacles. Melee Weapon Attack: +5 to hit, reach 15 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage. If the target is a creature, it is grappled (escape DC 16). Until this grapple ends, the target is restrained, and the octopus can't use its tentacles on another target.",
      effects: [
        {
          id: S.actionId(128, 203),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(128, 1203),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(128, 204),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(128, 205),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(128, 206),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+3'
                  },
                  {
                    id: S.actionId(128, 207),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('GRAPPLED')
                  },
                  {
                    id: S.actionId(128, 208),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('RESTRAINED')
                  },
                  {
                    id: S.actionId(128, 209),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_GIANT_OCTOPUS_TENTACLES
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
      id: S.featureId(128, 4),
      label: 'Ink Cloud (Recharges after a Short or Long Rest)',
      description:
        'Ink Cloud (Recharges after a Short or Long Rest). A 20-foot-radius cloud of ink extends all around the octopus if it is underwater. The area is heavily obscured for 1 minute, although a significant current can disperse the ink. After releasing the ink, the octopus can use the Dash action as a bonus action.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(128, 210),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(128, 1210), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GIANT_OCTOPUS_INK_CLOUD
        })
      ],
      order: 4
    }
  ]
}
