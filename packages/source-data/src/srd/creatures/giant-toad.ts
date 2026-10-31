import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
import { swallowedOutcome, heldByUseEffect } from './swallow.js'
export const giantToad: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_TOAD,
  label: 'Giant Toad',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 13,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 3
  },
  naturalArmorBonus: 0,
  hitPoints: 39,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 6,
    die: 10,
    modifier: 6
  },
  speeds: [...S.walk(20), ...S.swim(40)],
  senses: [S.darkvision(30)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(136, 1),
      label: 'Amphibious',
      description: 'Amphibious. The toad can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(136, 2),
      label: 'Standing Leap',
      description:
        "Standing Leap. The toad's long jump is up to 20 feet and its high jump is up to 10 feet, with or without a running start.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(136, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(136, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Standing Leap',
          reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE,
          instructions:
            "The toad's long jump is up to 20 feet and its high jump is up to 10 feet, with or without a running start."
        })
      ],
      order: 2
    },
    {
      id: S.featureId(136, 3),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) piercing damage plus 5 (1d10) poison damage, and the target is grappled (escape DC 13). Until this grapple ends, the target is restrained, and the toad can't bite another target.",
      effects: [
        {
          id: S.actionId(4874, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4874, 2),
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
              id: S.actionId(4874, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4874, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(4874, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10',
                    bonuses: [
                      {
                        id: S.actionId(4874, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(4874, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4874, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(4874, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('POISON'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10'
                  }
                ]
              }
            },
            {
              id: S.actionId(4874, 6),
              order: 3,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4874, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  S.grappledOutcome(136, {
                    localIndex: 1,
                    escapeDc: 13,
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
      id: S.featureId(136, 4),
      label: 'Swallow',
      description:
        "Swallow. The toad makes one bite attack against a Medium or smaller target it is grappling. If the attack hits, the target is swallowed, and the grapple ends. The swallowed target is blinded and restrained, it has total cover against attacks and other effects outside the toad, and it takes 10 (3d6) acid damage at the start of each of the toad's turns. The toad can have only one target swallowed at a time. If the toad dies, a swallowed creature is no longer restrained by it and can escape from the corpse using 5 feet of movement, exiting prone.",
      effects: [
        heldByUseEffect({
          effectId: S.actionId(136, 7),
          rangeId: S.actionId(136, 8),
          pathId: S.actionId(136, 9),
          outcome: swallowedOutcome(136, {
            localIndex: 10,
            damageOutcomeId: S.actionId(136, 10),
            escapeDc: 13,
            heldAtOnce: 1,
            largestTarget: S.SIZE_CODE.MEDIUM,
            damageType: 'ACID',
            diceConfig: '3d6'
          })
        })
      ],
      order: 4
    }
  ]
}
