import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shrieker: CreatureAuthored = {
  id: S.CREATURE_IDS.SHRIEKER,
  label: 'Shrieker',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.PLANT,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 1,
    DEXTERITY: 1,
    CONSTITUTION: 10,
    INTELLIGENCE: 1,
    WISDOM: 3,
    CHARISMA: 1,
  },
  armorClass: 5,
  hitPoints: 13,
  hitDice: '3d8',
  speeds: [],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(253, 1),
      label: 'False Appearance',
      description: 'False Appearance. While the shrieker remains motionless, it is indistinguishable from an ordinary fungus.',
      order: 1
    },
    {
      id: S.featureId(253, 2),
      label: 'Shriek',
      description: 'Shriek. When bright light or a creature is within 30 feet of the shrieker, it emits a shriek audible within 300 feet of it. The shrieker continues to shriek until the disturbance moves out of range and for 1d4 of the shrieker’s turns afterward.',
      order: 2
    }
  ]
}

