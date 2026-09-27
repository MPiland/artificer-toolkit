import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const grimlock: CreatureAuthored = {
  id: S.CREATURE_IDS.GRIMLOCK,
  label: 'Grimlock',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  tags: ['grimlock'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 9,
    WISDOM: 8,
    CHARISMA: 6
  },
  armorClass: 11,
  hitPoints: 11,
  hitDice: {
    count: 2,
    die: 8,
    modifier: 2
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(154, 3, 'PERCEPTION'),
    S.grantedSkillProficiency(154, 1, 'ATHLETICS', 'STEALTH'),
    S.grantedLanguageProficiency(154, 2, 'UNDERCOMMON')
  ],
  conditionImmunities: ['blinded'],
  senses: ['blindsight 30 ft. or 10 ft. while deafened (blind beyond this radius)'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(154, 1),
      label: 'Blind Senses',
      description:
        "Blind Senses. The grimlock can't use its blindsight while deafened and unable to smell.",
      order: 1
    },
    {
      id: S.featureId(154, 2),
      label: 'Keen Hearing and Smell',
      description:
        'Keen Hearing and Smell. The grimlock has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
      order: 2
    },
    {
      id: S.featureId(154, 3),
      label: 'Stone Camouflage',
      description:
        'Stone Camouflage. The grimlock has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.',
      order: 3
    },
    {
      id: S.featureId(154, 4),
      label: 'Spiked Bone Club',
      description:
        'Spiked Bone Club. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) bludgeoning damage plus 2 (1d4) piercing damage.',
      effects: [
        {
          id: S.actionId(154, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(154, 2),
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
              id: S.actionId(154, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(154, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(154, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+3'
                  }
                ]
              }
            },
            {
              id: S.actionId(154, 4),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(154, 4) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(154, 4),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4'
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
