import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const stirge: CreatureAuthored = {
  id: S.CREATURE_IDS.STIRGE,
  label: 'Stirge',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 4,
    DEXTERITY: 16,
    CONSTITUTION: 11,
    INTELLIGENCE: 2,
    WISDOM: 8,
    CHARISMA: 6
  },
  armorClass: 14,
  hitPoints: 2,
  hitDice: {
    count: 1,
    die: 4,
    modifier: 0
  },
  speeds: [...S.walk(10), ...S.fly(40)],
  senses: ['darkvision 60 ft.'],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(263, 1),
      label: 'Keen Smell',
      description:
        'Keen Smell. The stirge has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(263, 2),
      label: 'Blood Drain',
      description:
        'Blood Drain. The stirge attaches to a creature it hits. While attached, the stirge can’t attack and instead drains blood from the target. The target or a creature adjacent to it can use an action to detach the stirge.',
      effects: [
        {
          id: S.actionId(4592, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4592, 2),
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
              id: S.actionId(4592, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4592, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(4592, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1'
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
