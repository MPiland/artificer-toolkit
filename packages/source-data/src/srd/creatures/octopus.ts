import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const octopus: CreatureAuthored = {
  id: S.CREATURE_IDS.OCTOPUS,
  label: 'Octopus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 4,
    DEXTERITY: 15,
    CONSTITUTION: 11,
    INTELLIGENCE: 3,
    WISDOM: 10,
    CHARISMA: 4
  },
  naturalArmorBonus: 0,
  hitPoints: 3,
  hitDice: {
    count: 1,
    die: 6,
    modifier: 0
  },
  speeds: [...S.walk(5), ...S.swim(30)],
  proficiencies: [S.grantedSkillProficiency(7953, 1, 'PERCEPTION', 'STEALTH')],
  senses: [S.darkvision(30)],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(208, 1),
      label: 'Hold Breath',
      description:
        'Hold Breath. While out of water, the octopus can hold its breath for 30 minutes.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(208, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(208, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_OCTOPUS_HOLD_BREATH
        })
      ],
      order: 1
    },
    {
      id: S.featureId(208, 2),
      label: 'Underwater Camouflage',
      description:
        'Underwater Camouflage. The octopus has advantage on Dexterity (Stealth) checks made while underwater.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(208, 502),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(208, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_OCTOPUS_UNDERWATER_CAMOUFLAGE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(208, 3),
      label: 'Tentacles',
      description:
        "Tentacles. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1 bludgeoning damage, and the target is grappled (escape DC 10). Until this grapple ends, the octopus can't use its tentacles on another target.",
      effects: [
        {
          id: S.actionId(208, 503),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(208, 603),
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
              id: S.actionId(208, 803),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(208, 803) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(208, 930),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                    scalingKind: S.SCALING.NONE,
                    amount: 1
                  },
                  S.grappledOutcome(208, { localIndex: 1, escapeDc: 10, heldAtOnce: 1 }),
                  {
                    id: S.actionId(208, 938),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_OCTOPUS_TENTACLES
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
      id: S.featureId(208, 4),
      label: 'Ink Cloud (Recharges after a Short or Long Rest)',
      description:
        'Ink Cloud (Recharges after a Short or Long Rest). A 5-foot-radius cloud of ink extends all around the octopus if it is underwater. The area is heavily obscured for 1 minute, although a significant current can disperse the ink. After releasing the ink, the octopus can use the Dash action as a bonus action.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(208, 505),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        S.closedRuleEffect({
          id: S.actionId(208, 504),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(208, 604),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            },
            resourceUse: { chargeId: S.actionId(208, 505), cost: 1 }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_OCTOPUS_INK_CLOUD
        })
      ],
      order: 4
    },
    {
      id: S.featureId(208, 5),
      label: 'Water Breathing',
      description: 'Water Breathing. The octopus can breathe only underwater.',
      order: 5
    }
  ]
}
