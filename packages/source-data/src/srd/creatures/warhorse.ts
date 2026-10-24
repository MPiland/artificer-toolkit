import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { chargeEffect } from './chargeEffect.js'
import * as S from './shared.js'
export const warhorse: CreatureAuthored = {
  id: S.CREATURE_IDS.WARHORSE,
  label: 'Warhorse',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 12,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 7
  },
  naturalArmorBonus: 0,
  hitPoints: 19,
  details: [],
  proficiencies: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 3,
    die: 10,
    modifier: 3
  },
  speeds: [...S.walk(60)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(283, 1),
      label: 'Trampling Charge',
      description:
        'Trampling Charge. If the horse moves at least 20 feet straight toward a creature and then hits it with a hooves attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the horse can make another attack with its hooves against it as a bonus action.',
      effects: [
        chargeEffect({
          creatureIndex: 283,
          localIndex: 300,
          ridesFeatureId: S.featureId(283, 2),
          minFeet: 20,
          dc: 14
        })
      ],
      order: 1
    },
    {
      id: S.featureId(283, 2),
      label: 'Hooves',
      description:
        'Hooves. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(1917, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(1917, 2),
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
              id: S.actionId(1917, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(1917, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(1917, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+4'
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
