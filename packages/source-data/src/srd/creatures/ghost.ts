import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const ghost: CreatureAuthored = {
  id: S.CREATURE_IDS.GHOST,
  label: 'Ghost',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['hover'],
  abilityScores: {
    STRENGTH: 7,
    DEXTERITY: 13,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 12,
    CHARISMA: 17
  },
  naturalArmorBonus: 0,
  hitPoints: 45,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 10,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(0), ...S.fly(40)],
  damageResistances: [
    'acid',
    'fire',
    'lightning',
    'thunder',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['cold', 'necrotic', 'poison'],
  conditionImmunities: [
    'charmed',
    'exhaustion',
    'frightened',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(111, 1),
      label: 'Ethereal Sight',
      description:
        'Ethereal Sight. The ghost can see 60 feet into the Ethereal Plane when it is on the Material Plane, and vice versa.',
      order: 1
    },
    {
      id: S.featureId(111, 2),
      label: 'Incorporeal Movement',
      description:
        'Incorporeal Movement. The ghost can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.',
      grants: S.movementPassageGrants(S.actionId(111, 202), {
        creatures: 'ANY',
        mayEndInCreature: false,
        blockingBarriers: true,
        costMultiplier: 2
      }),
      order: 2
    },
    {
      id: S.featureId(111, 3),
      label: 'Withering Touch',
      description:
        'Withering Touch. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 17 (4d6 + 3) necrotic damage.',
      effects: [
        {
          id: S.actionId(7279, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7279, 2),
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
              id: S.actionId(7279, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7279, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7279, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d6+3'
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
      id: S.featureId(111, 4),
      label: 'Horrifying Visage',
      description:
        "Horrifying Visage. Each non-undead creature within 60 feet of the ghost that can see it must succeed on a DC 13 Wisdom saving throw or be frightened for 1 minute. If the save fails by 5 or more, the target also ages 1d4 10 years. A frightened target can repeat the saving throw at the end of each of its turns, ending the frightened condition on itself on a success. If a target's saving throw is successful or the effect ends for it, the target is immune to this ghost's Horrifying Visage for the next 24 hours. The aging effect can be reversed with a greater restoration spell, but only within 24 hours of it occurring.",
      effects: [
        {
          id: S.actionId(111, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(111, 1204),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 13
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(111, 1205),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            }
          },
          paths: [
            {
              id: S.actionId(111, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(111, 206),
                resultKind: 'SEQUENCE',
                duration: { id: S.actionId(111, 207), durationKind: 'MINUTE', amount: 1 },
                outcomes: [
                  {
                    id: S.actionId(111, 208),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  },
                  {
                    id: S.actionId(111, 209),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_GHOST_HORRIFYING_VISAGE
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
      id: S.featureId(111, 5),
      label: 'Etherealness',
      description:
        'Etherealness. The ghost enters the Ethereal Plane from the Material Plane, or vice versa. It is visible on the Material Plane while it is in the Border Ethereal, and vice versa, yet it can’t affect or be affected by anything on the other plane.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(111, 210),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(111, 1210), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Etherealness',
          reasonCode: 'GM_CHOICE',
          instructions:
            'The ghost enters the Ethereal Plane from the Material Plane, or back. While in the Border Ethereal it is visible on the Material Plane, and creatures there are visible to it, but neither can affect or be affected by anything on the other plane.'
        })
      ],
      order: 5
    },
    {
      id: S.featureId(111, 6),
      ruleDefinitionIds: [S.DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(111, 6)),
      label: 'Possession (Recharge 6)',
      description:
        "Possession (Recharge 6). One humanoid that the ghost can see within 5 feet of it must succeed on a DC 13 Charisma saving throw or be possessed by the ghost; the ghost then disappears, and the target is incapacitated and loses control of its body. The ghost now controls the body but doesn't deprive the target of awareness. The ghost can't be targeted by any attack, spell, or other effect, except ones that turn undead, and it retains its alignment, Intelligence, Wisdom, Charisma, and immunity to being charmed and frightened. It otherwise uses the possessed target's statistics, but doesn't gain access to the target's knowledge, class features, or proficiencies. The possession lasts until the body drops to 0 hit points, the ghost ends it as a bonus action, or the ghost is turned or forced out by an effect like the dispel evil and good spell. When the possession ends, the ghost reappears in an unoccupied space within 5 feet of the body. The target is immune to this ghost's Possession for 24 hours after succeeding on the saving throw or after the possession ends.",
      effects: [
        {
          id: S.actionId(111, 211),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(111, 1211),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CHARISMA,
              baseDc: 13
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(111, 1212),
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
              id: S.actionId(111, 212),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(111, 213),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(111, 214),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('INCAPACITATED')
                  },
                  {
                    id: S.actionId(111, 215),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Resolve the possession',
                    reasonCode: 'GM_CHOICE',
                    instructions:
                      "The ghost disappears and controls the target's body until the body drops to 0 hit points, the ghost ends it as a bonus action, or the ghost is turned or forced out. When the possession ends, the ghost reappears in an unoccupied space within 5 feet of the body. The target is immune to this ghost's Possession for 24 hours after succeeding on the save or after the possession ends."
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
