import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pitFiend: CreatureAuthored = {
  id: S.CREATURE_IDS.PIT_FIEND,
  label: 'Pit Fiend',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 26,
    DEXTERITY: 14,
    CONSTITUTION: 24,
    INTELLIGENCE: 22,
    WISDOM: 18,
    CHARISMA: 24,
    SPELLCASTING: 0
  },
  armorClass: 19,
  armorClassNote: 'natural armor',
  hitPoints: 300,
  hitDice: '24d10+168',
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(8042, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM'),
    S.grantedLanguageProficiency(8042, 2, 'INFERNAL')
  ],
  damageResistances: ['cold', 'bludgeoning', 'piercing', 'slashing'],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['truesight 120 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_20,
  xp: 25000,
  features: [
    {
      id: S.featureId(8042, 1),
      label: 'Fear Aura',
      description: 'Fear Aura. Any creature hostile to the pit fiend that starts its turn within 20 feet of the pit fiend must make a DC 21 Wisdom saving throw, unless the pit fiend is incapacitated. On a failed save, the creature is frightened until the start of its next turn. If a creature\'s saving throw is successful, the creature is immune to the pit fiend\'s Fear Aura for the next 24 hours.',
      order: 1
    },
    {
      id: S.featureId(8042, 2),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The pit fiend has advantage on saving throws against spells and other magical effects.',
      order: 2
    },
    {
      id: S.featureId(8042, 3),
      label: 'Magic Weapons',
      description: 'Magic Weapons. The pit fiend\'s weapon attacks are magical.',
      order: 3
    },
    {
      id: S.featureId(8042, 4),
      label: 'Innate Spellcasting',
      description: 'Innate Spellcasting. The pit fiend\'s spellcasting ability is Charisma (spell save DC 21). The pit fiend can innately cast the following spells, requiring no material components: At will: detect magic, fireball. 3/day each: hold monster, wall of fire.',
      order: 4
    },
    {
      id: S.featureId(8042, 5),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 5
    },
    {
      id: S.featureId(8042, 6),
      label: 'Multiattack',
      description: 'Multiattack. The pit fiend makes four attacks: one with its bite, one with its claw, one with its mace, and one with its tail.',
      order: 6
    },
    {
      id: S.featureId(8042, 7),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 22 (4d6 + 8) piercing damage. The target must succeed on a DC 21 Constitution saving throw or become poisoned. While poisoned in this way, the target can\'t regain hit points, and it takes 21 (6d6) poison damage at the start of each of its turns. The poisoned target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      order: 7
    },
    {
      id: S.featureId(8042, 8),
      label: 'Claw',
      description: 'Claw. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 17 (2d8 + 8) slashing damage.',
      order: 8
    },
    {
      id: S.featureId(8042, 9),
      label: 'Mace',
      description: 'Mace. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 15 (2d6 + 8) bludgeoning damage plus 21 (6d6) fire damage.',
      order: 9
    },
    {
      id: S.featureId(8042, 10),
      label: 'Tail',
      description: 'Tail. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 24 (3d10 + 8) bludgeoning damage.',
      order: 10
    }
  ]
}
