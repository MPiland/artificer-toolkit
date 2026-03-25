import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const homunculus: CreatureAuthored = {
  id: S.CREATURE_IDS.HOMUNCULUS,
  label: 'Homunculus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 4,
    DEXTERITY: 15,
    CONSTITUTION: 11,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 5,
  hitDice: '2d4',
  speeds: [...S.walk(20), ...S.fly(40)],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(4783, 1),
      label: 'Telepathic Bond',
      description: 'Telepathic Bond. While the homunculus is on the same plane of existence as its master, it can magically convey what it senses to its master, and the two can communicate telepathically.',
      order: 1
    },
    {
      id: S.featureId(4783, 2),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 1 piercing damage, and the target must succeed on a DC 10 Constitution saving throw or be poisoned for 1 minute. If the saving throw fails by 5 or more, the target is instead poisoned for 5 (1d10) minutes and unconscious while poisoned in this way.',
      order: 2
    }
  ]
}
