import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const gelatinousCube: CreatureAuthored = {
  id: S.CREATURE_IDS.GELATINOUS_CUBE,
  label: 'Gelatinous Cube',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.OOZE,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 3,
    CONSTITUTION: 20,
    INTELLIGENCE: 1,
    WISDOM: 6,
    CHARISMA: 1
  },
  naturalArmorBonus: 0,
  hitPoints: 84,
  hitDice: {
    count: 8,
    die: 10,
    modifier: 40
  },
  speeds: [...S.walk(15)],
  conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
  senses: ['blindsight 60 ft. (blind beyond this radius)'],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(109, 2),
      label: 'Ooze Cube',
      description:
        "Ooze Cube. The cube takes up its entire space. Other creatures can enter the space, but a creature that does so is subjected to the cube's Engulf and has disadvantage on the saving throw. Creatures inside the cube can be seen but have total cover. A creature within 5 feet of the cube can take an action to pull a creature or object out of the cube. Doing so requires a successful DC 12 Strength check, and the creature making the attempt takes 10 (3d6) acid damage. The cube can hold only one Large creature or up to four Medium or smaller creatures inside it at a time.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(109, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ENTER_AREA,
            range: { id: S.actionId(109, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GELATINOUS_CUBE_OOZE_CUBE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(109, 3),
      label: 'Transparent',
      description:
        "Transparent. Even when the cube is in plain sight, it takes a successful DC 15 Wisdom (Perception) check to spot a cube that has neither moved nor attacked. A creature that tries to enter the cube's space while unaware of the cube is surprised by the cube.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(109, 203),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(109, 1203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GELATINOUS_CUBE_TRANSPARENT
        })
      ],
      order: 3
    },
    {
      id: S.featureId(109, 4),
      label: 'Pseudopod',
      description:
        'Pseudopod. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 10 (3d6) acid damage.',
      effects: [
        {
          id: S.actionId(1107, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(1107, 2),
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
              id: S.actionId(1107, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(1107, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(1107, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
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
      id: S.featureId(109, 5),
      label: 'Engulf',
      description:
        "Engulf. The cube moves up to its speed. While doing so, it can enter Large or smaller creatures' spaces. Whenever the cube enters a creature's space, the creature must make a DC 12 Dexterity saving throw. On a successful save, the creature can choose to be pushed 5 feet back or to the side of the cube. A creature that chooses not to be pushed suffers the consequences of a failed saving throw. On a failed save, the cube enters the creature's space, and the creature takes 10 (3d6) acid damage and is engulfed. The engulfed creature can't breathe, is restrained, and takes 21 (6d6) acid damage at the start of each of the cube's turns. When the cube moves, the engulfed creature moves with it. An engulfed creature can try to escape by taking an action to make a DC 12 Strength check. On a success, the creature escapes and enters a space of its choice within 5 feet of the cube.",
      effects: [
        {
          id: S.actionId(1107, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(1107, 5),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(1107, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(1107, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(1107, 6),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: 'GELATINOUS_CUBE_ENGULF' as const
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
