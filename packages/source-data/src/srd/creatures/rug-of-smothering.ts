import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { SRD_ACROBATICS_SKILL_ID, SRD_ATHLETICS_SKILL_ID } from '../vocabulary.js'
import { conditionTypeId } from '../equipment/shared.js'
import { SRD_BREATHING_CAPABILITY_DEFINITION_ID } from '../ruleState.js'
import * as S from './shared.js'
export const rugOfSmothering: CreatureAuthored = {
  id: S.CREATURE_IDS.RUG_OF_SMOTHERING,
  label: 'Rug of Smothering',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 14,
    CONSTITUTION: 10,
    INTELLIGENCE: 1,
    WISDOM: 3,
    CHARISMA: 1
  },
  naturalArmorBonus: 0,
  hitPoints: 33,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 6,
    die: 10,
    modifier: 0
  },
  speeds: [...S.walk(10)],
  damageImmunities: ['poison', 'psychic'],
  conditionImmunities: [
    'blinded',
    'charmed',
    'deafened',
    'frightened',
    'paralyzed',
    'petrified',
    'poisoned'
  ],
  senses: [S.blindsight(60, '(blind beyond this radius)')],
  passivePerception: 6,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(240, 1),
      label: 'False Appearance',
      description:
        'False Appearance. While the rug remains motionless, it is indistinguishable from a normal rug.',
      order: 1
    },
    {
      id: S.featureId(240, 2),
      label: 'Smother',
      description:
        "Smother. Melee Weapon Attack: +5 to hit, reach 5 ft., one Medium or smaller creature. Hit: The creature is grappled (escape DC 13). Until this grapple ends, the target is restrained, blinded, and at risk of suffocating, and the rug can't smother another target. In addition, at the start of each of the target's turns, the target takes 10 (2d6 + 3) bludgeoning damage.",
      effects: [
        {
          id: S.actionId(7705, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7705, 2),
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
              id: S.actionId(7705, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7705, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7705, 3),
                    effectKind: S.EFFECT_KIND.ACTOR_RELATIONSHIP,
                    heldAtOnce: 1,
                    modules: [
                      {
                        id: S.actionId(7705, 4),
                        order: 1,
                        kind: 'TARGET_SIZE_MAXIMUM',
                        sizeCode: S.SIZE_CODE.MEDIUM
                      },
                      {
                        id: S.actionId(7705, 5),
                        order: 2,
                        kind: 'TARGET_DRAGGED'
                      },
                      {
                        id: S.actionId(7705, 6),
                        order: 3,
                        kind: 'SOURCE_ACTION_TARGET_RESTRICTION',
                        actionEffectIds: [S.actionId(7705, 1)]
                      },
                      {
                        id: S.actionId(7705, 7),
                        order: 4,
                        kind: 'ESCAPE_CHECK',
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        checks: {
                          skillIds: [SRD_ACROBATICS_SKILL_ID, SRD_ATHLETICS_SKILL_ID].sort(),
                          abilityDefinitionIds: []
                        },
                        dc: { kind: 'FIXED', value: 13 },
                        actorKinds: ['TARGET']
                      },
                      {
                        id: S.actionId(7705, 8),
                        order: 5,
                        kind: 'TARGET_CAPABILITY_SUPPRESSION',
                        capabilityDefinitionIds: [SRD_BREATHING_CAPABILITY_DEFINITION_ID]
                      }
                    ],
                    conditions: [
                      {
                        id: S.actionId(7705, 9),
                        effectKind: S.EFFECT_KIND.CONDITION,
                        conditionId: conditionTypeId('GRAPPLED')
                      },
                      {
                        id: S.actionId(7705, 10),
                        effectKind: S.EFFECT_KIND.CONDITION,
                        conditionId: conditionTypeId('RESTRAINED')
                      },
                      {
                        id: S.actionId(7705, 11),
                        effectKind: S.EFFECT_KIND.CONDITION,
                        conditionId: conditionTypeId('BLINDED')
                      }
                    ],
                    recurrence: {
                      turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' },
                      outcome: {
                        id: S.actionId(7705, 12),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '2d6+3'
                      }
                    }
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
      id: S.featureId(240, 3),
      label: 'Antimagic Susceptibility',
      description:
        "Antimagic Susceptibility. The rug is incapacitated while in the area of an antimagic field. If targeted by dispel magic, the rug must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute.",
      order: 3
    },
    {
      id: S.featureId(240, 4),
      label: 'Damage Transfer',
      description:
        'Damage Transfer. While it is grappling a creature, the rug takes only half the damage dealt to it, and the creature grappled by the rug takes the other half.',
      order: 4
    }
  ]
}
