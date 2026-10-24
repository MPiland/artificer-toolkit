import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'

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
  naturalArmorBonus: 0,
  hitPoints: 67,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
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
  senses: [S.darkvision(60)],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(298, 1),
      label: 'Incorporeal Movement',
      description:
        'Incorporeal Movement. The wraith can move through other creatures and objects as if they were difficult terrain.',
      grants: S.movementPassageGrants(S.actionId(298, 200), {
        creatures: 'ANY',
        mayEndInCreature: false,
        blockingBarriers: true,
        costMultiplier: 2
      }),
      order: 1
    },
    {
      id: S.featureId(298, 2),
      label: 'Sunlight Sensitivity',
      description:
        'Sunlight Sensitivity. While in sunlight, the wraith has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      grants: R.lightSensitivityGrants(298, 100, true),
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
                  S.lifeDrainSave({
                    id: S.actionId(298, 209),
                    savingThrowId: S.actionId(298, 216),
                    dc: 14,
                    reductionOutcomeId: S.actionId(298, 217),
                    damageOutcomeId: S.actionId(298, 208)
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
                    manifestKind: 'CREATURE'
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
