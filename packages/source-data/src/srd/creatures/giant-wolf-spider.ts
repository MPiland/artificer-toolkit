import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const giantWolfSpider: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_WOLF_SPIDER,
  label: 'Giant Wolf Spider',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 16,
    CONSTITUTION: 13,
    INTELLIGENCE: 3,
    WISDOM: 12,
    CHARISMA: 4
  },
  naturalArmorBonus: 0,
  hitPoints: 11,
  hitDice: {
    count: 2,
    die: 8,
    modifier: 2
  },
  speeds: [...S.walk(40), ...S.climb(40)],
  proficiencies: [
    S.grantedSkillExpertise(140, 2, 'STEALTH'),
    S.grantedSkillProficiency(140, 1, 'PERCEPTION')
  ],
  senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(140, 1),
      label: 'Spider Climb',
      description:
        'Spider Climb. The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      order: 1
    },
    {
      id: S.featureId(140, 2),
      label: 'Web Sense',
      description:
        'Web Sense. While in contact with a web, the spider knows the exact location of any other creature in contact with the same web.',
      order: 2
    },
    {
      id: S.featureId(140, 3),
      label: 'Web Walker',
      description: 'Web Walker. The spider ignores movement restrictions caused by webbing.',
      order: 3
    },
    {
      id: S.featureId(140, 4),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 4 (1d6 + 1) piercing damage, and the target must make a DC 11 Constitution saving throw, taking 7 (2d6) poison damage on a failed save, or half as much damage on a successful one. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.',
      effects: [
        {
          id: S.actionId(140, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(140, 2),
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
              id: S.actionId(140, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(140, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(140, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+1'
                  },
                  S.constitutionPoisonDamageSave({
                    id: S.actionId(140, 4),
                    savingThrowId: S.actionId(140, 901),
                    dc: 11,
                    failureDamageId: S.actionId(140, 902),
                    successDamageId: S.actionId(140, 903),
                    diceConfig: '2d6'
                  })
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
