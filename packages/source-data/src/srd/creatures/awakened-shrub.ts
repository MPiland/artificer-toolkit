import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const awakenedShrub: CreatureAuthored = {
  id: S.CREATURE_IDS.AWAKENED_SHRUB,
  label: 'Awakened Shrub',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.PLANT,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 3,
    DEXTERITY: 8,
    CONSTITUTION: 11,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 6
  },
  naturalArmorBonus: 0,
  hitPoints: 10,
  hitDice: {
    count: 3,
    die: 6,
    modifier: 0
  },
  speeds: [...S.walk(20)],
  damageVulnerabilities: ['fire'],
  damageResistances: ['piercing'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(30, 1),
      label: 'False Appearance',
      description:
        'False Appearance. While the shrub remains motionless, it is indistinguishable from a normal shrub.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(30, 101),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(30, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_FALSE_APPEARANCE
        })
      ],
      order: 1
    },
    {
      id: S.featureId(30, 2),
      label: 'Language Knowledge',
      description: 'one language known by its creator',
      order: 2
    },
    {
      id: S.featureId(30, 3),
      label: 'Rake',
      description:
        'Rake. Melee Weapon Attack: +1 to hit, reach 5 ft., one target. Hit: 1 (1d4 - 1) slashing damage. An awakened shrub is an ordinary shrub given sentience and mobility by the awaken spell or similar magic.',
      effects: [
        {
          id: S.actionId(30, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(30, 2),
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
              id: S.actionId(30, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(30, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(30, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4-1'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
