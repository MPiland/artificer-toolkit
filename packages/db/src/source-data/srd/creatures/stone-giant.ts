import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const stoneGiant: CreatureAuthored = {
  id: S.CREATURE_IDS.STONE_GIANT,
  label: 'Stone Giant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 15,
    CONSTITUTION: 22,
    INTELLIGENCE: 10,
    WISDOM: 14,
    CHARISMA: 12,
    SPELLCASTING: 0
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 126,
  hitDice: '11d10+66',
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(3307, 1, 'ATHLETICS', 'PERCEPTION')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(3307, 1),
      label: 'Stone Camouflage',
      description: 'Stone Camouflage. The giant has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.',
      order: 1
    },
    {
      id: S.featureId(3307, 2),
      label: 'Greatclub',
      description: 'Greatclub. Melee Weapon Attack: +9 to hit, reach 15 ft., one target. Hit: 19 (3d8 + 6) bludgeoning damage.',
      capabilities: [
        {
          id: S.actionId(3307, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3307, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(3307, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d8+6'
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(3307, 3),
      label: 'Rock',
      description: 'Rock. Ranged Weapon Attack: +9 to hit, range 60/240 ft., one target. Hit: 28 (4d10 + 6) bludgeoning damage.',
      order: 3
    }
  ]
}
