import { type CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const chainDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.CHAIN_DEVIL,
  label: 'Chain Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 18,
    INTELLIGENCE: 11,
    WISDOM: 12,
    CHARISMA: 14,
  },
  armorClass: 16,
  armorClassNote: 'natural armor',
  hitPoints: 85,
  hitDice: {
    count: 10,
    die: 8,
    modifier: 40,
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(61, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(61, 2, 'INFERNAL')
  ],
  damageResistances: ["cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(61, 1),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 1
    },
    {
      id: S.featureId(61, 2),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      order: 2
    },
    {
      id: S.featureId(61, 3),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 3
    },
    {
      id: S.featureId(61, 4),
      label: 'Multiattack',
      description: 'Multiattack. The devil makes two attacks with its chains.',
      order: 4
    },
    {
      id: S.featureId(61, 5),
      label: 'Chain',
      description: "Chain. Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 11 (2d6 + 4) slashing damage. The target is grappled (escape DC 14) if the devil isn't already grappling a creature. Until this grapple ends, the target is restrained and takes 7 (2d6) piercing damage at the start of each of its turns.",
      order: 5
    },
    {
      id: S.featureId(61, 6),
      label: 'Animate Chains (Recharges after a Short or Long Rest)',
      description: "Up to four chains the devil can see within 60 feet of it magically sprout razor-edged barbs and animate under the devil's control, provided that the chains aren't being worn or carried. Each animated chain is an object with AC 20, 20 hit points, resistance to piercing damage, and immunity to psychic and thunder damage. When the devil uses Multiattack on its turn, it can use each animated chain to make one additional chain attack. An animated chain can grapple one creature of its own but can't make attacks while grappling. An animated chain reverts to its inanimate state if reduced to 0 hit points or if the devil is incapacitated or dies.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(61, 12),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      order: 6
    },
    {
      id: S.featureId(61, 7),
      label: 'Unnerving Mask',
      description: "When a creature the devil can see starts its turn within 30 feet of the devil, the devil can create the illusion that it looks like one of the creature's departed loved ones or bitter enemies. If the creature can see the devil, it must succeed on a DC 14 Wisdom saving throw or be frightened until the end of its turn.",
      order: 7
    }
  ]
}

