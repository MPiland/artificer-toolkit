import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const crocodile: CreatureAuthored = {
  id: S.CREATURE_IDS.CROCODILE,
  label: 'Crocodile',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 10,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 5
  },
  armorClass: 12,
  armorClassNote: 'natural armor',
  hitPoints: 19,
  hitDice: {
    count: 3,
    die: 10,
    modifier: 3
  },
  speeds: [...S.walk(20), ...S.swim(30)],
  proficiencies: [S.grantedSkillProficiency(73, 1, 'STEALTH')],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(73, 1),
      label: 'Hold Breath',
      description: 'Hold Breath. The crocodile can hold its breath for 15 minutes.',
      order: 1
    },
    {
      id: S.featureId(73, 2),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 7 (1d10 + 2) piercing damage, and the target is grappled (escape DC 12). Until this grapple ends, the target is restrained, and the crocodile can't bite another target.",
      effects: [
        {
          id: S.actionId(73, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(73, 2),
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
              id: S.actionId(73, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(73, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(73, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10+2'
                  }
                ]
              }
            },
            {
              id: S.actionId(73, 4),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(73, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(73, 4),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('GRAPPLED')
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
