import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const giantCrab: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_CRAB,
  label: 'Giant Crab',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 15,
    CONSTITUTION: 11,
    INTELLIGENCE: 1,
    WISDOM: 9,
    CHARISMA: 3
  },
  naturalArmorBonus: 3,
  hitPoints: 13,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 3,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30), ...S.swim(30)],
  proficiencies: [S.grantedSkillProficiency(119, 1, 'STEALTH')],
  senses: [S.blindsight(30)],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(119, 1),
      label: 'Amphibious',
      description: 'Amphibious. The crab can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(119, 2),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage, and the target is grappled (escape DC 11). The crab has two claws, each of which can grapple only one target.',
      effects: [
        {
          id: S.actionId(119, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(119, 2),
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
              id: S.actionId(119, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(119, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(119, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+1'
                  }
                ]
              }
            },
            {
              id: S.actionId(119, 4),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(119, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [S.grappledOutcome(119, { localIndex: 1, escapeDc: 11, heldAtOnce: 2 })]
              }
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
