import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const hyena: CreatureAuthored = {
  id: S.CREATURE_IDS.HYENA,
  label: 'Hyena',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 13,
    CONSTITUTION: 12,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 5,
  hitDice: {
    count: 1,
    die: 8,
    modifier: 1
  },
  speeds: [...S.walk(50)],
  proficiencies: [S.grantedSkillProficiency(170, 1, 'PERCEPTION')],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(170, 1),
      label: 'Pack Tactics',
      description:
        "Pack Tactics. The hyena has advantage on an attack roll against a creature if at least one of the hyena's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      order: 1
    },
    {
      id: S.featureId(170, 2),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 3 (1d6) piercing damage.',
      effects: [
        {
          id: S.actionId(170, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(170, 2),
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
              id: S.actionId(170, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(170, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(170, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6'
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
