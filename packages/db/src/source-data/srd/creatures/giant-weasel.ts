import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const giantWeasel: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_WEASEL,
  label: 'Giant Weasel',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 16,
    CONSTITUTION: 10,
    INTELLIGENCE: 4,
    WISDOM: 12,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 13,
  hitPoints: 9,
  hitDice: '2d8',
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(139, 1, 'PERCEPTION', 'STEALTH')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(139, 1),
      label: 'Keen Hearing and Smell',
      description: 'Keen Hearing and Smell. The weasel has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
      order: 1
    },
    {
      id: S.featureId(139, 2),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) piercing damage.',
      capabilities: [
        {
          id: S.actionId(139, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(139, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(139, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4+3'
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
