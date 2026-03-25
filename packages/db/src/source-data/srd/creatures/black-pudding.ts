import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const blackPudding: CreatureAuthored = {
  id: S.CREATURE_IDS.BLACK_PUDDING,
  label: 'Black Pudding',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.OOZE,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 5,
    CONSTITUTION: 16,
    INTELLIGENCE: 1,
    WISDOM: 6,
    CHARISMA: 1,
    SPELLCASTING: 0
  },
  armorClass: 7,
  hitPoints: 68,
  hitDice: '8d10+24',
  speeds: [...S.walk(20), ...S.climb(20)],
  damageImmunities: ['acid', 'cold', 'lightning', 'slashing'],
  conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'prone', 'restrained'],
  senses: ['blindsight 60 ft. (blind beyond this radius)'],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(5665, 1),
      label: 'Amorphous',
      description: 'Amorphous. The pudding can move through a space as narrow as 1 inch wide without squeezing.',
      order: 1
    },
    {
      id: S.featureId(5665, 2),
      label: 'Corrosive Form',
      description: 'Corrosive Form. A creature that hits the pudding with a melee attack roll takes 4 (1d8) acid damage. Nonmagical ammunition is destroyed immediately after hitting the pudding and dealing any damage. Any nonmagical weapon takes a cumulative -1 penalty to attack rolls immediately after dealing damage to the pudding and coming into contact with it. The weapon is destroyed if the penalty reaches -5. The penalty can be removed by casting the mending spell on the weapon. In 1 minute, the pudding can eat through 2 feet of nonmagical wood or metal.',
      order: 2
    },
    {
      id: S.featureId(5665, 3),
      label: 'Spider Climb',
      description: 'Spider Climb. The pudding can climb difficult surfaces, including along ceilings, without needing to make an ability check.',
      order: 3
    },
    {
      id: S.featureId(5665, 4),
      label: 'Dissolving Pseudopod',
      description: 'Dissolving Pseudopod. Melee Attack Roll: +5, reach 10 ft. Hit: 17 (4d6 + 3) acid damage. Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the mending spell on the armor.',
      capabilities: [
        {
          id: S.actionId(5665, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(5665, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(5665, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('ACID'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '4d6',
              bonuses: [
                {
                  id: S.actionId(5665, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(5665, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(5665, 5),
      label: 'Split',
      description: 'Split. While the pudding is Large or Medium and has 10 or more hit points, it becomes Bloodied or is subjected to lightning or slashing damage, it splits into two new black puddings. Each new pudding is one size smaller than the original pudding and acts on its own initiative. The original pudding\'s hit points are divided evenly between the new puddings, round down.',
      capabilities: [
        {
          id: S.reactionId(5665, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.REACTION,
              amount: 1
            },
            range: {
              id: S.reactionId(5665, 2),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.reactionId(5665, 3),
              branch: S.BRANCH.ON_USE,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.RULE
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
