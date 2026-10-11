import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const hunterShark: CreatureAuthored = {
  id: S.CREATURE_IDS.HUNTER_SHARK,
  label: 'Hunter Shark',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 13,
    CONSTITUTION: 15,
    INTELLIGENCE: 1,
    WISDOM: 10,
    CHARISMA: 4
  },
  naturalArmorBonus: 1,
  hitPoints: 45,
  hitDice: {
    count: 6,
    die: 10,
    modifier: 12
  },
  speeds: [...S.walk(0), ...S.swim(40)],
  proficiencies: [S.grantedSkillProficiency(168, 1, 'PERCEPTION')],
  senses: ['blindsight 30 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(168, 1),
      label: 'Blood Frenzy',
      description:
        "Blood Frenzy. The shark has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
      order: 1
    },
    {
      id: S.featureId(168, 2),
      label: 'Water Breathing',
      description: 'Water Breathing. The shark can breathe only underwater.',
      order: 2
    },
    {
      id: S.featureId(168, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) piercing damage.',
      effects: [
        {
          id: S.actionId(168, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(168, 2),
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
              id: S.actionId(168, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(168, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(168, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
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
      order: 3
    }
  ]
}
