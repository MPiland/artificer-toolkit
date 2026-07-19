import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const grayOoze: CreatureAuthored = {
  id: S.CREATURE_IDS.GRAY_OOZE,
  label: 'Gray Ooze',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.OOZE,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 6,
    CONSTITUTION: 16,
    INTELLIGENCE: 1,
    WISDOM: 6,
    CHARISMA: 2,
  },
  armorClass: 8,
  hitPoints: 22,
  hitDice: '3d8+9',
  speeds: [...S.walk(10), ...S.climb(10)],
  proficiencies: [
    S.grantedSkillProficiency(9475, 1, 'STEALTH')
  ],
  damageResistances: ['acid', 'cold', 'fire'],
  conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
  senses: ['blindsight 60 ft. (blind beyond this radius)'],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(149, 1),
      label: 'Amorphous',
      description: 'Amorphous. The ooze can move through a space as narrow as 1 inch wide without squeezing.',
      order: 1
    },
    {
      id: S.featureId(149, 2),
      label: 'Corrode Metal',
      description: 'Corrode Metal. Any nonmagical weapon made of metal that hits the ooze corrodes. After dealing damage, the weapon takes a permanent and cumulative -1 penalty to damage rolls. If its penalty drops to -5, the weapon is destroyed. Nonmagical ammunition made of metal that hits the ooze is destroyed after dealing damage. The ooze can eat through 2-inch-thick, nonmagical metal in 1 round.',
      order: 2
    },
    {
      id: S.featureId(149, 3),
      label: 'False Appearance',
      description: 'False Appearance. While the ooze remains motionless, it is indistinguishable from an oily pool or wet rock.',
      order: 3
    },
    {
      id: S.featureId(149, 4),
      label: 'Pseudopod',
      description: 'Pseudopod. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage plus 7 (2d6) acid damage, and if the target is wearing nonmagical metal armor, its armor is partly corroded and takes a permanent and cumulative -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10.',
      order: 4
    }
  ]
}

