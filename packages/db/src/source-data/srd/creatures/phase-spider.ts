import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const phaseSpider: CreatureAuthored = {
  id: S.CREATURE_IDS.PHASE_SPIDER,
  label: 'Phase Spider',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 15,
    CONSTITUTION: 12,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 6
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 32,
  hitDice: {
    count: 5,
    die: 10,
    modifier: 5
  },
  speeds: [...S.walk(30), ...S.climb(30)],
  proficiencies: [S.grantedSkillProficiency(218, 1, 'STEALTH')],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(218, 1),
      label: 'Ethereal Jaunt',
      description:
        'Ethereal Jaunt. As a bonus action, the spider can magically shift from the Material Plane to the Ethereal Plane, or vice versa.',
      order: 1
    },
    {
      id: S.featureId(218, 2),
      label: 'Spider Climb',
      description:
        'Spider Climb. The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      order: 2
    },
    {
      id: S.featureId(218, 3),
      label: 'Web Walker',
      description: 'Web Walker. The spider ignores movement restrictions caused by webbing.',
      order: 3
    },
    {
      id: S.featureId(218, 4),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 7 (1d10 + 2) piercing damage, and the target must make a DC 11 Constitution saving throw, taking 18 (4d8) poison damage on a failed save, or half as much damage on a successful one. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way. A phase spider possesses the magical ability to phase in and out of the Ethereal Plane. It seems to appear out of nowhere and quickly vanishes after attacking. Its movement on the Ethereal Plane before coming back to the Material Plane makes it seem like it can teleport.',
      effects: [
        {
          id: S.actionId(218, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(218, 2),
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
              id: S.actionId(218, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(218, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(218, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10',
                    bonuses: [
                      {
                        id: S.actionId(218, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(218, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(218, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(218, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('POISON'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8',
                    multiplier: 0.5
                  }
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
