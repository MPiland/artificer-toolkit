import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const youngGoldDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_GOLD_DRAGON,
  label: 'Young Gold Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 14,
    CONSTITUTION: 21,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 20,
    SPELLCASTING: 0
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 178,
  hitDice: '17d10+85',
  speeds: [...S.walk(40), ...S.climb(40), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedSkillProficiency(9907, 1, 'INSIGHT', 'PERCEPTION', 'STEALTH')
  ],
  damageImmunities: ['fire'],
  senses: ['blindsight 30 ft.', 'darkvision 120 ft.'],
  passivePerception: 19,
  challengeRatingId: S.CR.CR_10,
  xp: 5900,
  features: [
    {
      id: S.featureId(9907, 1),
      label: 'Amphibious',
      description: 'Amphibious. The dragon can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(9907, 2),
      label: 'Fire Breath',
      description: 'Fire Breath. The dragon exhales fire in a cone. Each creature in that area must make a Dexterity saving throw, taking fire damage on a failed save, or half as much damage on a successful one.',
      order: 2
    },
    {
      id: S.featureId(9907, 3),
      label: 'Multiattack',
      description: 'Multiattack. The dragon makes three attacks: one with its bite and two with its claws.',
      order: 3
    },
    {
      id: S.featureId(9907, 4),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus fire damage.',
      order: 4
    },
    {
      id: S.featureId(9907, 5),
      label: 'Claw',
      description: 'Claw. Melee Weapon Attack: +11 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.',
      order: 5
    }
  ]
}

