import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const marilith: CreatureAuthored = {
  id: S.CREATURE_IDS.MARILITH,
  label: 'Marilith',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 20,
    CONSTITUTION: 20,
    INTELLIGENCE: 18,
    WISDOM: 16,
    CHARISMA: 20,
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 189,
  hitDice: {
    count: 18,
    die: 10,
    modifier: 90,
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(3284, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(3284, 2, 'ABYSSAL')
  ],
  senses: ['truesight 120 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_16,
  xp: 15000,
  features: [
    {
      id: S.featureId(192, 1),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The marilith has advantage on saving throws against spells and other magical effects.',
      order: 1
    },
    {
      id: S.featureId(192, 2),
      label: 'Magic Weapons',
      description: 'Magic Weapons. The marilith\'s weapon attacks are magical.',
      order: 2
    },
    {
      id: S.featureId(192, 3),
      label: 'Reactive',
      description: 'Reactive. The marilith can take one reaction on every turn in a combat.',
      order: 3
    },
    {
      id: S.featureId(192, 4),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 4
    },
    {
      id: S.featureId(192, 5),
      label: 'Multiattack',
      description: 'Multiattack. The marilith makes seven attacks: six with its longswords and one with its tail.',
      order: 5
    },
    {
      id: S.featureId(192, 6),
      label: 'Longsword',
      description: 'Longsword. Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
      order: 6
    },
    {
      id: S.featureId(192, 7),
      label: 'Tail',
      description: 'Tail. Melee Weapon Attack: +9 to hit, reach 10 ft., one creature. Hit: 15 (2d10 + 4) bludgeoning damage. If the target is Medium or smaller, it is grappled (escape DC 19). Until this grapple ends, the target is restrained, the marilith can automatically hit the target with its tail, and the marilith can\'t make tail attacks against other targets.',
      order: 7
    },
    {
      id: S.featureId(192, 8),
      label: 'Teleport',
      description: 'Teleport. The marilith magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.',
      order: 8
    }
  ]
}

