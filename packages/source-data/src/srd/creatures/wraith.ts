import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const wraith: CreatureAuthored = {
  id: S.CREATURE_IDS.WRAITH,
  label: 'Wraith',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  tags: ['hover'],
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 16,
    CONSTITUTION: 16,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 15
  },
  armorClass: 13,
  hitPoints: 67,
  hitDice: {
    count: 9,
    die: 8,
    modifier: 27
  },
  speeds: [...S.fly(60)],
  damageResistances: [
    'acid',
    'cold',
    'fire',
    'lightning',
    'thunder',
    "bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: [
    'charmed',
    'exhaustion',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained'
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(298, 1),
      label: 'Incorporeal Movement',
      description:
        'Incorporeal Movement. The wraith can move through other creatures and objects as if they were difficult terrain.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(298, 200),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(298, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_WRAITH_INCORPOREAL_MOVEMENT
        })
      ],
      order: 1
    },
    {
      id: S.featureId(298, 2),
      label: 'Sunlight Sensitivity',
      description:
        'Sunlight Sensitivity. While in sunlight, the wraith has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(298, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(298, 203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_SUNLIGHT_SENSITIVITY
        })
      ],
      order: 2
    },
    {
      id: S.featureId(298, 3),
      label: 'Life Drain',
      description:
        'Life Drain. Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 21 (4d8 + 3) necrotic damage. The target must succeed on a DC 14 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0.',
      effects: [
        {
          id: S.actionId(298, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(298, 205),
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
              id: S.actionId(298, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(298, 207),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(298, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8+3'
                  },
                  {
                    id: S.actionId(298, 209),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_WRAITH_LIFE_DRAIN
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
      id: S.featureId(298, 4),
      label: 'Create Specter',
      description:
        "Create Specter. The wraith targets a humanoid within 10 feet of it that has been dead for no longer than 1 minute and died violently. The target's spirit rises as a specter in the space of its corpse or in the nearest unoccupied space. The specter is under the wraith's control. The wraith can have no more than seven specters under its control at one time.",
      effects: [
        {
          id: S.actionId(298, 210),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(298, 211),
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
              id: S.actionId(298, 212),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(298, 213),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(298, 214),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: 'CREATURE',
                    creatureId: S.CREATURE_IDS.SPECTER
                  },
                  {
                    id: S.actionId(298, 215),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_WRAITH_CREATE_SPECTER
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
