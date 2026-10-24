import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import * as S from './shared.js'

export const giantOctopus: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_OCTOPUS,
  label: 'Giant Octopus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 13,
    CONSTITUTION: 13,
    INTELLIGENCE: 4,
    WISDOM: 10,
    CHARISMA: 4
  },
  naturalArmorBonus: 0,
  hitPoints: 52,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 8,
    die: 10,
    modifier: 8
  },
  speeds: [...S.walk(10), ...S.swim(60)],
  proficiencies: [S.grantedSkillExpertise(128, 1, 'PERCEPTION', 'STEALTH')],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(128, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. While out of water, the octopus can hold its breath for 1 hour.',
      order: 1
    },
    {
      id: S.featureId(128, 2),
      label: 'Underwater Camouflage',
      description:
        'Underwater Camouflage. The octopus has advantage on Dexterity (Stealth) checks made while underwater.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(128, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(128, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Underwater Camouflage',
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            'The octopus has advantage on Dexterity (Stealth) checks made while underwater.'
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
                  S.grappledOutcome(128, {
                    localIndex: 1,
                    escapeDc: 16,
                    heldAtOnce: 1,
                    untilEnds: ['RESTRAINED']
                  })
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
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(128, 211),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(128, 210),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(128, 1210), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF },
            resourceUse: { chargeId: S.actionId(128, 211), cost: 1 }
          },
          paths: [
            {
              id: S.actionId(128, 212),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(128, 212) + '__result',
                resultKind: 'SEQUENCE',
                // "After releasing the ink, the octopus can use the Dash action as a bonus action":
                // the offer lasts to the end of the turn the ink is released on.
                duration: { id: S.actionId(128, 215), durationKind: 'TURN', amount: 1 },
                lifecycle: {
                  turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' },
                  grantedActions: [
                    {
                      activation: S.ACTIVATION_CODE.BONUS_ACTION,
                      actionDefinitionIds: [SRD_BASIC_ACTION_IDS.DASH]
                    }
                  ]
                },
                outcomes: [
                  { id: S.actionId(128, 213), effectKind: S.EFFECT_KIND.APPLY_GRANT, grants: {} },
                  {
                    id: S.actionId(128, 214),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Place the ink cloud',
                    reasonCode: 'EXTERNAL_WORLD_STATE',
                    instructions:
                      'A 20-foot-radius cloud of ink extends all around the octopus if it is underwater. The area is heavily obscured for 1 minute, although a significant current can disperse the ink.'
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
      id: S.featureId(128, 5),
      label: 'Water Breathing',
      description: 'Water Breathing. The octopus can breathe only underwater.',
      order: 5
    }
  ]
}
