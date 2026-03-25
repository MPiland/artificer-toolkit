import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const eagle: CreatureAuthored = {
  id: S.CREATURE_IDS.EAGLE,
  label: 'Eagle',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 15,
    CONSTITUTION: 10,
    INTELLIGENCE: 2,
    WISDOM: 14,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 3,
  hitDice: '1d6',
  speeds: [...S.walk(10), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillProficiency(93, 1, 'PERCEPTION')
  ],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(93, 1),
      label: 'Keen Sight',
      description: 'Keen Sight. The eagle has advantage on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(93, 2),
      label: 'Talons',
      description: 'Talons. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) slashing damage.',
      capabilities: [
        {
          id: S.actionId(93, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(93, 2),
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
              id: S.actionId(93, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d4',
              bonuses: [
                {
                  id: S.actionId(93, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.DEXTERITY,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
