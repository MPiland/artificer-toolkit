import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const giantFrog: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_FROG,
  label: 'Giant Frog',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 13,
    CONSTITUTION: 11,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 3
  },
  naturalArmorBonus: 0,
  hitPoints: 18,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 4,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [S.grantedSkillProficiency(124, 1, 'PERCEPTION', 'STEALTH')],
  senses: [S.darkvision(30)],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(124, 1),
      label: 'Amphibious',
      description: 'Amphibious. The frog can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(124, 2),
      label: 'Standing Leap',
      description:
        "Standing Leap. The frog's long jump is up to 20 feet and its high jump is up to 10 feet, with or without a running start.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(124, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(124, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Standing Leap',
          reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE,
          instructions:
            "The frog's long jump is up to 20 feet and its high jump is up to 10 feet, with or without a running start."
        })
      ],
      order: 2
    },
    {
      id: S.featureId(124, 3),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) piercing damage, and the target is grappled (escape DC 11). Until this grapple ends, the target is restrained, and the frog can't bite another target.",
      effects: [
        {
          id: S.actionId(124, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(124, 2),
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
              id: S.actionId(124, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(124, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(124, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+1'
                  }
                ]
              }
            },
            {
              id: S.actionId(124, 4),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(124, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  S.grappledOutcome(124, {
                    localIndex: 1,
                    escapeDc: 11,
                    heldAtOnce: 1,
                    untilEnds: ['RESTRAINED'],
                    restrictedActionEffectIds: [S.actionId(124, 1)]
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
      id: S.featureId(124, 4),
      label: 'Swallow',
      description:
        "Swallow. The frog makes one bite attack against a Small or smaller target it is grappling. If the attack hits, the target is swallowed, and the grapple ends. The swallowed target is blinded and restrained, it has total cover against attacks and other effects outside the frog, and it takes 5 (2d4) acid damage at the start of each of the frog's turns. The frog can have only one target swallowed at a time. If the frog dies, a swallowed creature is no longer restrained by it and can escape from the corpse using 5 feet of movement, exiting prone.",
      effects: [
        {
          id: S.actionId(124, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(124, 6),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(124, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(124, 7) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(124, 7),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Resolve the swallow',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      "The frog makes one bite attack against a Small or smaller target it is grappling. If it hits, the target is swallowed and the grapple ends. The swallowed target has total cover against attacks and other effects outside the frog and takes 5 (2d4) acid damage at the start of each of the frog's turns. The frog can have only one target swallowed at a time. If the frog dies, the swallowed creature is no longer restrained by it and can escape from the corpse using 5 feet of movement, exiting prone."
                  },
                  {
                    id: S.actionId(124, 207),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('BLINDED')
                  },
                  {
                    id: S.actionId(124, 208),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('RESTRAINED')
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
