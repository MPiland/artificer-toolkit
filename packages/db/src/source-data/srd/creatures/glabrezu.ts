import type { CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const glabrezu: CreatureAuthored = {
  id: S.CREATURE_IDS.GLABREZU,
  label: 'Glabrezu',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 15,
    CONSTITUTION: 21,
    INTELLIGENCE: 19,
    WISDOM: 17,
    CHARISMA: 16,
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 157,
  hitDice: '15d10+75',
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(142, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(142, 2, 'ABYSSAL')
  ],
  damageResistances: ['cold, fire, lightning; bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: ['truesight 120 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_9,
  xp: 5000,
  features: [
    {
      id: S.featureId(142, 1),
      label: 'Innate Spellcasting',
      description: "Innate Spellcasting. The glabrezu's spellcasting ability is Intelligence (spell save DC 16). The glabrezu can innately cast the following spells, requiring no material components: At will: darkness, detect magic, dispel magic. 1/day each: confusion, fly, power word stun.",
      order: 1
    },
    {
      id: S.featureId(142, 2),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The glabrezu has advantage on saving throws against spells and other magical effects.',
      order: 2
    },
    {
      id: S.featureId(142, 3),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 3
    },
    {
      id: S.featureId(142, 4),
      label: 'Multiattack',
      description: 'The glabrezu makes four attacks: two with its pincers and two with its fists. Alternatively, it makes two attacks with its pincers and casts one spell.',
      order: 4
    },
    {
      id: S.featureId(142, 5),
      label: 'Pincer',
      description: 'Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 16 (2d10 + 5) bludgeoning damage. If the target is a Medium or smaller creature, it is grappled (escape DC 15). The glabrezu has two pincers, each of which can grapple only one target.',
      order: 5
    },
    {
      id: S.featureId(142, 6),
      label: 'Fist',
      description: 'Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) bludgeoning damage.',
      order: 6
    }
  ]
}

