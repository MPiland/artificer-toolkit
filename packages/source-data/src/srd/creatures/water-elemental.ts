import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
export const waterElemental: CreatureAuthored = {
  id: S.CREATURE_IDS.WATER_ELEMENTAL,
  label: 'Water Elemental',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 14,
    CONSTITUTION: 18,
    INTELLIGENCE: 5,
    WISDOM: 10,
    CHARISMA: 8
  },
  naturalArmorBonus: 2,
  hitPoints: 114,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 12,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(30), ...S.swim(90)],
  proficiencies: [S.grantedLanguageProficiency(285, 1, 'AQUAN')],
  damageResistances: ['acid', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['poison'],
  conditionImmunities: [
    'exhaustion',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained',
    'unconscious'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(285, 1),
      label: 'Water Form',
      description:
        'Water Form. The elemental can enter a hostile creature’s space and stop there. It can move through a space as narrow as 1 inch wide without squeezing.',
      grants: S.movementPassageGrants(S.actionId(285, 200), {
        creatures: 'ANY',
        mayEndInCreature: true,
        blockingBarriers: false,
        costMultiplier: 1
      }),
      order: 1
    },
    {
      id: S.featureId(285, 2),
      label: 'Freeze',
      description:
        'Freeze. If the elemental takes cold damage, it partially freezes; its speed is reduced by 20 feet until the end of its next turn.',
      effects: [
        S.incomingDamageGrantEffect(
          S.actionId(285, 202),
          ['COLD'],
          [...S.walk(30), ...S.swim(90)].map(({ speedId }) => ({
            valueDomainCode: S.VALUE_DOMAIN_CODE.SPEED,
            domain: { speedId },
            modifierKind: S.MODIFIER_KIND.PENALTY,
            payload: { amount: 20, unit: S.MEASUREMENT_UNIT_CODE.FEET }
          }))
        )
      ],
      order: 2
    },
    {
      id: S.featureId(285, 3),
      label: 'Whelm (Recharge 4-6)',
      description:
        "Whelm (Recharge 4-6). Each creature in the elemental's space must make a DC 15 Strength saving throw. On a failure, a target takes 13 (2d8 + 4) bludgeoning damage. If it is Large or smaller, it is also grappled (escape DC 14). Until this grapple ends, the target is restrained and unable to breathe unless it can breathe water. If the saving throw is successful, the target is pushed out of the elemental's space. The elemental can grapple one Large creature or up to two Medium or smaller creatures at one time. At the start of each of the elemental's turns, each target grappled by it takes 13 (2d8 + 4) bludgeoning damage. A creature within 5 feet of the elemental can pull a creature or object out of it by taking an action to make a DC 14 Strength and succeeding.",
      effects: [
        {
          id: S.actionId(285, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(285, 205),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 15
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(285, 206), rangeKind: S.RANGE_KIND.SELF },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(285, 207),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(285, 208),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(285, 209),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+4'
                  },
                  S.grappledOutcome(285, {
                    localIndex: 1,
                    escapeDc: 14,
                    heldAtOnce: 2,
                    largestTarget: S.SIZE_CODE.LARGE,
                    untilEnds: ['RESTRAINED'],
                    // "At the start of each of the elemental's turns": counted on the holder's turns.
                    recurrence: {
                      turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
                      outcome: {
                        id: S.actionId(285, 214),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '2d8+4'
                      }
                    }
                  }),
                  {
                    id: S.actionId(285, 210),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Resolve the whelm',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      'The held target is unable to breathe unless it can breathe water. The elemental can grapple one Large creature or up to two Medium or smaller creatures at one time. A creature within 5 feet of the elemental can pull a creature or object out of it by taking an action to make a DC 14 Strength check and succeeding.'
                  }
                ]
              }
            },
            {
              id: S.actionId(285, 211),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(285, 212),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(285, 213),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Push the target out',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions: "The target is pushed out of the elemental's space."
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
      id: S.featureId(285, 4),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(6023, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(6023, 2),
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
              id: S.actionId(6023, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6023, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(6023, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+4'
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
      id: S.featureId(285, 5),
      label: 'Multiattack',
      description: 'Multiattack. The elemental makes two slam attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(285, 4) }] }] }
        ]
      },
      order: 5
    }
  ]
}
