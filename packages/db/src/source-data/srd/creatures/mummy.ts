import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const mummy: CreatureAuthored = {
  id: S.CREATURE_IDS.MUMMY,
  label: 'Mummy',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 8,
    CONSTITUTION: 15,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 12,
    SPELLCASTING: 0
  },
  armorClass: 11,
  armorClassNote: 'natural armor',
  hitPoints: 58,
  hitDice: '9d8+18',
  speeds: [...S.walk(20)],
  proficiencies: [S.grantedSaveProficiency(2585, 1, 'WISDOM')],
  damageVulnerabilities: ['fire'],
  damageResistances: ['bludgeoning', 'piercing', 'slashing'],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(201, 1),
      label: 'Language Limitation',
      description: 'Understands the languages it knew in life.',
      order: 1
    },
    {
      id: S.featureId(201, 2),
      label: 'Multiattack',
      description: 'Multiattack. The mummy can use its Dreadful Glare and makes one attack with its rotting fist.',
      order: 2
    },
    {
      id: S.featureId(201, 3),
      label: 'Rotting Fist',
      description: 'Rotting Fist. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage plus 10 (3d6) necrotic damage. If the target is a creature, it must succeed on a DC 12 Constitution saving throw or be cursed with mummy rot. The cursed target can\'t regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target\'s hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic.',
      order: 3
    },
    {
      id: S.featureId(201, 4),
      label: 'Dreadful Glare',
      description: 'Dreadful Glare. The mummy targets one creature it can see within 60 feet of it. If the target can see the mummy, it must succeed on a DC 11 Wisdom saving throw against this magic or become frightened until the end of the mummy\'s next turn. If the target fails the saving throw by 5 or more, it is also paralyzed for the same duration. A target that succeeds on the saving throw is immune to the Dreadful Glare of all mummies (but not mummy lords) for the next 24 hours.',
      order: 4
    }
  ]
}

