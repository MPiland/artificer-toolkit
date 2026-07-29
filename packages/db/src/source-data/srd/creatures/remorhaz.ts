import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const remorhaz: CreatureAuthored = {
  id: S.CREATURE_IDS.REMORHAZ,
  label: 'Remorhaz',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 24,
    DEXTERITY: 13,
    CONSTITUTION: 21,
    INTELLIGENCE: 4,
    WISDOM: 10,
    CHARISMA: 5
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 195,
  hitDice: {
    count: 17,
    die: 12,
    modifier: 85
  },
  speeds: [...S.walk(30), ...S.burrow(20)],
  damageImmunities: ['cold', 'fire'],
  senses: ['darkvision 60 ft.', 'tremorsense 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(235, 1),
      label: 'Heated Body',
      description:
        'Heated Body. A creature that touches the remorhaz or hits it with a melee attack while within 5 feet of it takes 10 (3d6) fire damage.',
      order: 1
    },
    {
      id: S.featureId(235, 2),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 40 (6d10 + 7) piercing damage plus 10 (3d6) fire damage. If the target is a Large or smaller creature, it is grappled (escape DC 17). Until this grapple ends, the target is restrained, and the remorhaz can bite only the grappled creature.',
      effects: [
        {
          id: S.actionId(2620, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2620, 2),
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
              id: S.actionId(2620, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2620, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2620, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '6d10+7'
                  }
                ]
              }
            },
            {
              id: S.actionId(2620, 4),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2620, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2620, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  }
                ]
              }
            },
            {
              id: S.actionId(2620, 5),
              order: 3,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2620, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2620, 5),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('GRAPPLED')
                  }
                ]
              }
            },
            {
              id: S.actionId(2620, 6),
              order: 4,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2620, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2620, 6),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('RESTRAINED')
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
      id: S.featureId(235, 3),
      label: 'Swallow',
      description:
        "Swallow. The remorhaz makes one bite attack against a Medium or smaller target it is grappling. If the attack hits, the target is swallowed, the grapple ends, and the target is no longer restrained. A swallowed creature is blinded and restrained, it has total cover against attacks and other effects outside the remorhaz, and it takes 21 (6d6) acid damage at the start of each of the remorhaz's turns. The remorhaz can have only one creature swallowed at a time. If the remorhaz dies, a swallowed creature is no longer restrained by it and can escape from the corpse using 10 feet of movement, exiting prone.",
      order: 3
    }
  ]
}
