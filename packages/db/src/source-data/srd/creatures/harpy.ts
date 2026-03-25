import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const harpy: CreatureAuthored = {
  id: S.CREATURE_IDS.HARPY,
  label: 'Harpy',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 13,
    CONSTITUTION: 12,
    INTELLIGENCE: 7,
    WISDOM: 10,
    CHARISMA: 13,
    SPELLCASTING: 0
  },
  armorClass: 11,
  hitPoints: 38,
  hitDice: '7d8+7',
  speeds: [...S.walk(20), ...S.fly(40)],
  proficiencies: [
    S.grantedLanguageProficiency(159, 1, 'COMMON')
  ],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(159, 1),
      label: 'Multiattack',
      description: 'Multiattack. The harpy makes two attacks: one with its claws and one with its club.',
      order: 1
    },
    {
      id: S.featureId(159, 2),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 6 (2d4 + 1) slashing damage.',
      order: 2
    },
    {
      id: S.featureId(159, 3),
      label: 'Club',
      description: 'Club. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 3 (1d4 + 1) bludgeoning damage.',
      order: 3
    },
    {
      id: S.featureId(159, 4),
      label: 'Luring Song',
      description: 'Luring Song. The harpy sings a magical melody. Every humanoid and giant within 300 feet of the harpy that can hear the song must succeed on a DC 11 Wisdom saving throw or be charmed until the song ends. The harpy must take a bonus action on its subsequent turns to continue singing. It can stop singing at any time. The song ends if the harpy is incapacitated.',
      order: 4
    }
  ]
}
