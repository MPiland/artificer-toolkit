import type { SystemSeedRecord } from '../content.js'

export const SRD_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
export const SRD_USER_ID = '00000000-0000-0000-0000-000000000000'

// ─── Vocabulary ID helpers ────────────────────────────────────────────────────
// IDs are stable UUIDs derived from a simple prefix+index scheme so they are
// deterministic and never require a live DB round-trip to resolve.

function vocabId(domain: string, index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-${domain}-${hex}00000000`
}

// Domain codes (encoded in the UUID clock_seq_hi field) — kept short:
const D = {
  alignment: '0001',
  conditionType: '0002',
  currency: '0003',
  damageType: '0004',
  heritage: '0005',
  language: '0006',
  magicSchool: '0007',
  passive: '0008',
  rarity: '0009',
  sense: '000a',
  skill: '000b',
  speed: '000c',
  terrain: '000d',
  challengeRating: '000e',
  creatureType: '000f',
  lifestyle: '0010',
  ability: '0011'
} as const

// ─── Abilities ───────────────────────────────────────────────────────────────

export const SRD_ABILITIES = [
  {
    id: vocabId(D.ability, 1),
    code: 'STRENGTH',
    label: 'Strength',
    short: 'STR',
    description: 'Strength measures physical power, bodily force, and the ability to exert muscle.'
  },
  {
    id: vocabId(D.ability, 2),
    code: 'DEXTERITY',
    label: 'Dexterity',
    short: 'DEX',
    description: 'Dexterity measures agility, reflexes, balance, and precise control of movement.'
  },
  {
    id: vocabId(D.ability, 3),
    code: 'CONSTITUTION',
    label: 'Constitution',
    short: 'CON',
    description: 'Constitution measures endurance, stamina, and overall bodily health.'
  },
  {
    id: vocabId(D.ability, 4),
    code: 'INTELLIGENCE',
    label: 'Intelligence',
    short: 'INT',
    description: 'Intelligence measures reasoning ability, memory, and analytical thinking.'
  },
  {
    id: vocabId(D.ability, 5),
    code: 'WISDOM',
    label: 'Wisdom',
    short: 'WIS',
    description: 'Wisdom measures perception, intuition, awareness, and insight.'
  },
  {
    id: vocabId(D.ability, 6),
    code: 'CHARISMA',
    label: 'Charisma',
    short: 'CHA',
    description: 'Charisma measures confidence, presence, and the ability to influence others.'
  }
] as const

export type SrdAbilityCode = (typeof SRD_ABILITIES)[number]['code']

/** The SRD's ability codes, the keys its ability-score records and references use. */
export const ABILITY_CODE = Object.fromEntries(SRD_ABILITIES.map(({ code }) => [code, code])) as {
  readonly [Code in SrdAbilityCode]: Code
}

/** Stable UUID references used by authored mechanics; codes remain catalogue keys only. */
export const SRD_ABILITY_DEFINITION_IDS = {
  STRENGTH: SRD_ABILITIES[0].id,
  DEXTERITY: SRD_ABILITIES[1].id,
  CONSTITUTION: SRD_ABILITIES[2].id,
  INTELLIGENCE: SRD_ABILITIES[3].id,
  WISDOM: SRD_ABILITIES[4].id,
  CHARISMA: SRD_ABILITIES[5].id
} as const

// ─── Alignments ───────────────────────────────────────────────────────────────

export const SRD_ALIGNMENTS = [
  { id: vocabId(D.alignment, 1), code: 'LAWFUL_GOOD', label: 'Lawful Good' },
  { id: vocabId(D.alignment, 2), code: 'NEUTRAL_GOOD', label: 'Neutral Good' },
  { id: vocabId(D.alignment, 3), code: 'CHAOTIC_GOOD', label: 'Chaotic Good' },
  { id: vocabId(D.alignment, 4), code: 'LAWFUL_NEUTRAL', label: 'Lawful Neutral' },
  { id: vocabId(D.alignment, 5), code: 'TRUE_NEUTRAL', label: 'True Neutral' },
  { id: vocabId(D.alignment, 6), code: 'CHAOTIC_NEUTRAL', label: 'Chaotic Neutral' },
  { id: vocabId(D.alignment, 7), code: 'LAWFUL_EVIL', label: 'Lawful Evil' },
  { id: vocabId(D.alignment, 8), code: 'NEUTRAL_EVIL', label: 'Neutral Evil' },
  { id: vocabId(D.alignment, 9), code: 'CHAOTIC_EVIL', label: 'Chaotic Evil' },
  { id: vocabId(D.alignment, 10), code: 'UNALIGNED', label: 'Unaligned' }
]

// ─── Condition Types ──────────────────────────────────────────────────────────

export const SRD_CONDITION_TYPES = [
  {
    id: vocabId(D.conditionType, 1),
    code: 'BLINDED',
    label: 'Blinded',
    description:
      "A blinded creature can't see and automatically fails any ability check that requires sight."
  },
  {
    id: vocabId(D.conditionType, 2),
    code: 'CHARMED',
    label: 'Charmed',
    description:
      "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects."
  },
  {
    id: vocabId(D.conditionType, 3),
    code: 'DEAFENED',
    label: 'Deafened',
    description:
      "A deafened creature can't hear and automatically fails any ability check that requires hearing."
  },
  {
    id: vocabId(D.conditionType, 4),
    code: 'EXHAUSTION',
    levelled: true,
    label: 'Exhaustion',
    description:
      'Some special abilities and environmental hazards cause a special condition called exhaustion.'
  },
  {
    id: vocabId(D.conditionType, 5),
    code: 'FRIGHTENED',
    label: 'Frightened',
    description:
      'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.'
  },
  {
    id: vocabId(D.conditionType, 6),
    code: 'GRAPPLED',
    label: 'Grappled',
    description:
      "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed."
  },
  {
    id: vocabId(D.conditionType, 7),
    code: 'INCAPACITATED',
    label: 'Incapacitated',
    description: "An incapacitated creature can't take actions or reactions."
  },
  {
    id: vocabId(D.conditionType, 8),
    code: 'INVISIBLE',
    unseen: true,
    label: 'Invisible',
    description:
      'An invisible creature is impossible to see without the aid of magic or a special sense.'
  },
  {
    id: vocabId(D.conditionType, 9),
    code: 'PARALYZED',
    label: 'Paralyzed',
    description: "A paralyzed creature is incapacitated and can't move or speak."
  },
  {
    id: vocabId(D.conditionType, 10),
    code: 'PETRIFIED',
    label: 'Petrified',
    description:
      'A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance.'
  },
  {
    id: vocabId(D.conditionType, 11),
    code: 'POISONED',
    label: 'Poisoned',
    description: 'A poisoned creature has disadvantage on attack rolls and ability checks.'
  },
  {
    id: vocabId(D.conditionType, 12),
    code: 'PRONE',
    label: 'Prone',
    description:
      "A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition."
  },
  {
    id: vocabId(D.conditionType, 13),
    code: 'RESTRAINED',
    label: 'Restrained',
    description:
      "A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed."
  },
  {
    id: vocabId(D.conditionType, 14),
    code: 'STUNNED',
    label: 'Stunned',
    description: "A stunned creature is incapacitated, can't move, and can speak only falteringly."
  },
  {
    id: vocabId(D.conditionType, 15),
    code: 'UNCONSCIOUS',
    label: 'Unconscious',
    description:
      "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings."
  }
]

// ─── Currencies ───────────────────────────────────────────────────────────────

export const SRD_GOLD_CURRENCY_ID = vocabId(D.currency, 4)

export const SRD_CURRENCIES = [
  { id: vocabId(D.currency, 1), code: 'CP', baseValue: 1, label: 'Copper Piece', short: 'cp' },
  { id: vocabId(D.currency, 2), code: 'SP', baseValue: 10, label: 'Silver Piece', short: 'sp' },
  { id: vocabId(D.currency, 3), code: 'EP', baseValue: 50, label: 'Electrum Piece', short: 'ep' },
  { id: SRD_GOLD_CURRENCY_ID, code: 'GP', baseValue: 100, label: 'Gold Piece', short: 'gp' },
  { id: vocabId(D.currency, 5), code: 'PP', baseValue: 1000, label: 'Platinum Piece', short: 'pp' }
]

// ─── Damage Types ─────────────────────────────────────────────────────────────

export const SRD_DAMAGE_TYPES = [
  {
    id: vocabId(D.damageType, 1),
    code: 'ACID',
    label: 'Acid',
    description:
      "The corrosive spray of a black dragon's breath and the dissolving enzymes secreted by a black pudding deal acid damage."
  },
  {
    id: vocabId(D.damageType, 2),
    code: 'BLUDGEONING',
    label: 'Bludgeoning',
    description:
      'Blunt force attacks—hammers, falling, constriction, and the like—deal bludgeoning damage.'
  },
  {
    id: vocabId(D.damageType, 3),
    code: 'COLD',
    label: 'Cold',
    description:
      "The infernal chill radiating from an ice devil's spear and the frigid blast of a white dragon's breath deal cold damage."
  },
  {
    id: vocabId(D.damageType, 4),
    code: 'FIRE',
    label: 'Fire',
    description: 'Red dragons breathe fire, and many spells conjure flames to deal fire damage.'
  },
  {
    id: vocabId(D.damageType, 5),
    code: 'FORCE',
    label: 'Force',
    description:
      'Force is pure magical energy focused into a damaging form. Most effects that deal force damage are spells.'
  },
  {
    id: vocabId(D.damageType, 6),
    code: 'LIGHTNING',
    label: 'Lightning',
    description: "A lightning bolt spell and a blue dragon's breath deal lightning damage."
  },
  {
    id: vocabId(D.damageType, 7),
    code: 'NECROTIC',
    label: 'Necrotic',
    description:
      'Necrotic damage, dealt by certain undead and a spell such as chill touch, withers matter and even the soul.'
  },
  {
    id: vocabId(D.damageType, 8),
    code: 'PIERCING',
    label: 'Piercing',
    description:
      "Puncturing and impaling attacks, including spears and monsters' bites, deal piercing damage."
  },
  {
    id: vocabId(D.damageType, 9),
    code: 'POISON',
    label: 'Poison',
    description: "Venomous stings and the toxic gas of a green dragon's breath deal poison damage."
  },
  {
    id: vocabId(D.damageType, 10),
    code: 'PSYCHIC',
    label: 'Psychic',
    description: "Mental abilities such as a mind flayer's psionic blast deal psychic damage."
  },
  {
    id: vocabId(D.damageType, 11),
    code: 'RADIANT',
    label: 'Radiant',
    description:
      "Radiant damage, dealt by a cleric's flame strike spell or an angel's smiting weapon, sears the flesh like fire and overloads the spirit with power."
  },
  {
    id: vocabId(D.damageType, 12),
    code: 'SLASHING',
    label: 'Slashing',
    description: "Swords, axes, and monsters' claws deal slashing damage."
  },
  {
    id: vocabId(D.damageType, 13),
    code: 'THUNDER',
    label: 'Thunder',
    description:
      'A concussive burst of sound, such as the effect of the thunderwave spell, deals thunder damage.'
  }
]

// ─── Languages ────────────────────────────────────────────────────────────────

const SRD_HERITAGES = [
  { id: vocabId(D.heritage, 1), code: 'HUMAN', label: 'Human' },
  { id: vocabId(D.heritage, 2), code: 'ELVEN', label: 'Elven' },
  { id: vocabId(D.heritage, 3), code: 'DWARVEN', label: 'Dwarven' },
  { id: vocabId(D.heritage, 4), code: 'HALFLING', label: 'Halfling' },
  { id: vocabId(D.heritage, 5), code: 'GNOMISH', label: 'Gnomish' },
  { id: vocabId(D.heritage, 6), code: 'DRACONIC', label: 'Draconic' },
  { id: vocabId(D.heritage, 7), code: 'ORCISH', label: 'Orcish' },
  { id: vocabId(D.heritage, 8), code: 'INFERNAL', label: 'Infernal' }
]

export const SRD_HUMAN_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'HUMAN')!.id
export const SRD_ELVEN_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'ELVEN')!.id
export const SRD_DWARVEN_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'DWARVEN')!.id
export const SRD_HALFLING_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'HALFLING')!.id
export const SRD_GNOMISH_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'GNOMISH')!.id
export const SRD_DRACONIC_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'DRACONIC')!.id
export const SRD_ORCISH_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'ORCISH')!.id
export const SRD_INFERNAL_HERITAGE_ID = SRD_HERITAGES.find((entry) => entry.code === 'INFERNAL')!.id

export const SRD_LANGUAGES = [
  // Standard languages
  {
    id: vocabId(D.language, 1),
    code: 'COMMON',
    label: 'Common',
    description: 'Standard language spoken across most of the world.'
  },
  {
    id: vocabId(D.language, 2),
    code: 'DWARVISH',
    label: 'Dwarvish',
    description: 'Language of the dwarves, with a runic script.'
  },
  {
    id: vocabId(D.language, 3),
    code: 'ELVISH',
    label: 'Elvish',
    description: 'Language of the elves, with flowing script.'
  },
  {
    id: vocabId(D.language, 4),
    code: 'GIANT',
    label: 'Giant',
    description: 'Language of giants and giant-kin.'
  },
  {
    id: vocabId(D.language, 5),
    code: 'GNOMISH',
    label: 'Gnomish',
    description: 'Language of the gnomes.'
  },
  {
    id: vocabId(D.language, 6),
    code: 'GOBLIN',
    label: 'Goblin',
    description: 'Language of goblinoids.'
  },
  {
    id: vocabId(D.language, 7),
    code: 'HALFLING',
    label: 'Halfling',
    description: 'Language of halflings.'
  },
  { id: vocabId(D.language, 8), code: 'ORC', label: 'Orc', description: 'Language of orcs.' },
  // Exotic languages
  {
    id: vocabId(D.language, 9),
    code: 'ABYSSAL',
    label: 'Abyssal',
    description: 'Language of demons.'
  },
  {
    id: vocabId(D.language, 10),
    code: 'CELESTIAL',
    label: 'Celestial',
    description: 'Language of celestials.'
  },
  {
    id: vocabId(D.language, 11),
    code: 'DRACONIC',
    label: 'Draconic',
    description: 'Language of dragons and dragonborn.'
  },
  {
    id: vocabId(D.language, 12),
    code: 'DEEP_SPEECH',
    label: 'Deep Speech',
    description: 'Language of aberrations.'
  },
  {
    id: vocabId(D.language, 13),
    code: 'INFERNAL',
    label: 'Infernal',
    description: 'Language of devils.'
  },
  {
    id: vocabId(D.language, 14),
    code: 'PRIMORDIAL',
    label: 'Primordial',
    description: 'Language of elementals.'
  },
  {
    id: vocabId(D.language, 15),
    code: 'SYLVAN',
    label: 'Sylvan',
    description: 'Language of fey creatures.'
  },
  {
    id: vocabId(D.language, 16),
    code: 'UNDERCOMMON',
    label: 'Undercommon',
    description: 'Trade language of the Underdark.'
  },
  // Additional fixed SRD creature languages
  {
    id: vocabId(D.language, 17),
    code: 'AQUAN',
    label: 'Aquan',
    description: 'Aquan is the water-tuned dialect of Primordial.'
  },
  {
    id: vocabId(D.language, 18),
    code: 'AURAN',
    label: 'Auran',
    description: 'Auran is the air-tuned dialect of Primordial.'
  },
  {
    id: vocabId(D.language, 19),
    code: 'IGNAN',
    label: 'Ignan',
    description: 'Ignan is the fire-tuned dialect of Primordial.'
  },
  {
    id: vocabId(D.language, 20),
    code: 'TERRAN',
    label: 'Terran',
    description: 'Terran is the earth-tuned dialect of Primordial.'
  },
  {
    id: vocabId(D.language, 21),
    code: 'DRUIDIC',
    label: 'Druidic',
    description: 'A secret language used by druids.'
  },
  {
    id: vocabId(D.language, 22),
    code: 'THIEVES_CANT',
    label: "Thieves' Cant",
    description: 'A secret mix of dialect, jargon, and code used by rogues.'
  },
  {
    id: vocabId(D.language, 23),
    code: 'BLINK_DOG',
    label: 'Blink Dog',
    description: 'The language used by blink dogs.'
  },
  {
    id: vocabId(D.language, 24),
    code: 'GIANT_EAGLE',
    label: 'Giant Eagle',
    description: 'The language used by giant eagles.'
  },
  {
    id: vocabId(D.language, 25),
    code: 'GIANT_ELK',
    label: 'Giant Elk',
    description: 'The language used by giant elk.'
  },
  {
    id: vocabId(D.language, 26),
    code: 'GIANT_OWL',
    label: 'Giant Owl',
    description: 'The language used by giant owls.'
  },
  {
    id: vocabId(D.language, 27),
    code: 'GNOLL',
    label: 'Gnoll',
    description: 'The language used by gnolls.'
  },
  {
    id: vocabId(D.language, 28),
    code: 'OTYUGH',
    label: 'Otyugh',
    description: 'The language used by otyughs.'
  },
  {
    id: vocabId(D.language, 29),
    code: 'SAHUAGIN',
    label: 'Sahuagin',
    description: 'The language used by sahuagin.'
  },
  {
    id: vocabId(D.language, 30),
    code: 'SPHINX',
    label: 'Sphinx',
    description: 'The language used by sphinxes.'
  },
  {
    id: vocabId(D.language, 31),
    code: 'WINTER_WOLF',
    label: 'Winter Wolf',
    description: 'The language used by winter wolves.'
  },
  {
    id: vocabId(D.language, 32),
    code: 'WORG',
    label: 'Worg',
    description: 'The language used by worgs.'
  }
]

const SRD_LIFESTYLES = [
  {
    id: vocabId(D.lifestyle, 1),
    code: 'WRETCHED',
    label: 'Wretched',
    description: 'You live in inhumane conditions with little shelter, comfort, or safety.'
  },
  {
    id: vocabId(D.lifestyle, 2),
    code: 'SQUALID',
    label: 'Squalid',
    description: 'You subsist in poor conditions, staying on the edge of health and dignity.'
  },
  {
    id: vocabId(D.lifestyle, 3),
    code: 'POOR',
    label: 'Poor',
    description: 'You can survive in modest but difficult circumstances with few comforts.'
  },
  {
    id: vocabId(D.lifestyle, 4),
    code: 'MODEST',
    label: 'Modest',
    description: 'You maintain a simple but stable standard of living.'
  },
  {
    id: vocabId(D.lifestyle, 5),
    code: 'COMFORTABLE',
    label: 'Comfortable',
    description: 'You have enough means for dependable shelter, food, and ordinary comforts.'
  },
  {
    id: vocabId(D.lifestyle, 6),
    code: 'WEALTHY',
    label: 'Wealthy',
    description: 'You enjoy a high standard of living with quality accommodations and services.'
  },
  {
    id: vocabId(D.lifestyle, 7),
    code: 'ARISTOCRATIC',
    label: 'Aristocratic',
    description: 'You live with exceptional luxury, status, and access to elite circles.'
  }
]

// ─── Magic Schools ────────────────────────────────────────────────────────────

export const SRD_MAGIC_SCHOOLS = [
  {
    id: vocabId(D.magicSchool, 1),
    code: 'ABJURATION',
    label: 'Abjuration',
    description: 'Spells of protection, blocking, and banishing.'
  },
  {
    id: vocabId(D.magicSchool, 2),
    code: 'CONJURATION',
    label: 'Conjuration',
    description: 'Spells that produce objects and creatures out of thin air.'
  },
  {
    id: vocabId(D.magicSchool, 3),
    code: 'DIVINATION',
    label: 'Divination',
    description: 'Spells that enable the caster to learn secrets of the past, present, and future.'
  },
  {
    id: vocabId(D.magicSchool, 4),
    code: 'ENCHANTMENT',
    label: 'Enchantment',
    description: 'Spells that affect the minds of others.'
  },
  {
    id: vocabId(D.magicSchool, 5),
    code: 'EVOCATION',
    label: 'Evocation',
    description: 'Spells that manipulate magical energy to produce a desired effect.'
  },
  {
    id: vocabId(D.magicSchool, 6),
    code: 'ILLUSION',
    label: 'Illusion',
    description: 'Spells that deceive the senses or minds of others.'
  },
  {
    id: vocabId(D.magicSchool, 7),
    code: 'NECROMANCY',
    label: 'Necromancy',
    description: 'Spells that manipulate the energies of life and death.'
  },
  {
    id: vocabId(D.magicSchool, 8),
    code: 'TRANSMUTATION',
    label: 'Transmutation',
    description: 'Spells that change the properties of a creature, object, or environment.'
  }
]

// ─── Rarities ─────────────────────────────────────────────────────────────────

const SRD_RARITIES = [
  { id: vocabId(D.rarity, 1), code: 'COMMON', label: 'Common' },
  { id: vocabId(D.rarity, 2), code: 'UNCOMMON', label: 'Uncommon' },
  { id: vocabId(D.rarity, 3), code: 'RARE', label: 'Rare' },
  { id: vocabId(D.rarity, 4), code: 'VERY_RARE', label: 'Very Rare' },
  { id: vocabId(D.rarity, 5), code: 'LEGENDARY', label: 'Legendary' },
  { id: vocabId(D.rarity, 6), code: 'ARTIFACT', label: 'Artifact' }
]

// ─── Senses ───────────────────────────────────────────────────────────────────

const SRD_SENSES = [
  {
    id: vocabId(D.sense, 1),
    code: 'DARKVISION',
    label: 'Darkvision',
    description:
      'A creature with darkvision can see in dim light within a specified range as if it were bright light, and in darkness as if it were dim light.'
  },
  {
    id: vocabId(D.sense, 2),
    code: 'BLINDSIGHT',
    label: 'Blindsight',
    description:
      'A creature with blindsight can perceive its surroundings without relying on sight.'
  },
  {
    id: vocabId(D.sense, 3),
    code: 'TREMORSENSE',
    label: 'Tremorsense',
    description:
      'A creature with tremorsense can detect and pinpoint the origin of vibrations within a specific range.'
  },
  {
    id: vocabId(D.sense, 4),
    code: 'TRUESIGHT',
    label: 'Truesight',
    description:
      'A creature with truesight can see in normal and magical darkness, see invisible creatures and objects, automatically detect visual illusions, and see into the Ethereal Plane.'
  },
  {
    id: vocabId(D.sense, 5),
    code: 'SEE_INVISIBILITY',
    label: 'See Invisibility',
    description:
      'A creature with this sense sees invisible creatures and objects as if they were visible.'
  },
  {
    id: vocabId(D.sense, 6),
    code: 'DEVILS_SIGHT',
    label: "Devil's Sight",
    description:
      'A creature with this sense sees normally in darkness, both magical and nonmagical.'
  }
]

// Named sense ID helpers — consumed by races.ts, creatures.ts, and anywhere
// a sense grant needs to reference a vocabulary sense ID.
export const SRD_DARKVISION_SENSE_ID = SRD_SENSES[0]!.id
export const SRD_BLINDSIGHT_SENSE_ID = SRD_SENSES[1]!.id
export const SRD_TREMORSENSE_SENSE_ID = SRD_SENSES[2]!.id
export const SRD_TRUESIGHT_SENSE_ID = SRD_SENSES[3]!.id
export const SRD_SEE_INVISIBILITY_SENSE_ID = SRD_SENSES[4]!.id
export const SRD_DEVILS_SIGHT_SENSE_ID = SRD_SENSES[5]!.id

// ─── Skills ───────────────────────────────────────────────────────────────────

export const SRD_ACROBATICS_SKILL_ID = vocabId(D.skill, 1)
export const SRD_ATHLETICS_SKILL_ID = vocabId(D.skill, 4)
const SRD_INSIGHT_SKILL_ID = vocabId(D.skill, 7)
const SRD_INVESTIGATION_SKILL_ID = vocabId(D.skill, 9)
export const SRD_MEDICINE_SKILL_ID = vocabId(D.skill, 10)
export const SRD_PERCEPTION_SKILL_ID = vocabId(D.skill, 12)
export const SRD_STEALTH_SKILL_ID = vocabId(D.skill, 17)
export const SRD_WALK_SPEED_ID = vocabId(D.speed, 1)

export const SRD_SKILLS = [
  {
    id: SRD_ACROBATICS_SKILL_ID,
    code: 'ACROBATICS',
    label: 'Acrobatics',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    description:
      'Your Dexterity (Acrobatics) check covers attempts to stay on your feet in a tricky situation.'
  },
  {
    id: vocabId(D.skill, 2),
    code: 'ANIMAL_HANDLING',
    label: 'Animal Handling',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    description:
      "When there is any question whether you can calm a domesticated animal, keep a mount from getting spooked, or intuit an animal's intentions, the GM might call for a Wisdom (Animal Handling) check."
  },
  {
    id: vocabId(D.skill, 3),
    code: 'ARCANA',
    label: 'Arcana',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
    description:
      'Your Intelligence (Arcana) check measures your ability to recall lore about spells, magic items, eldritch symbols, magical traditions, the planes of existence, and the inhabitants of those planes.'
  },
  {
    id: SRD_ATHLETICS_SKILL_ID,
    code: 'ATHLETICS',
    label: 'Athletics',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.STRENGTH,
    description:
      'Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming.'
  },
  {
    id: vocabId(D.skill, 5),
    code: 'DECEPTION',
    label: 'Deception',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA,
    description:
      'Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions.'
  },
  {
    id: vocabId(D.skill, 6),
    code: 'HISTORY',
    label: 'History',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
    description:
      'Your Intelligence (History) check measures your ability to recall lore about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.'
  },
  {
    id: SRD_INSIGHT_SKILL_ID,
    code: 'INSIGHT',
    label: 'Insight',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    description:
      'Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature.'
  },
  {
    id: vocabId(D.skill, 8),
    code: 'INTIMIDATION',
    label: 'Intimidation',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA,
    description:
      'When you attempt to influence someone through overt threats, hostile actions, and physical violence, the GM might ask you to make a Charisma (Intimidation) check.'
  },
  {
    id: SRD_INVESTIGATION_SKILL_ID,
    code: 'INVESTIGATION',
    label: 'Investigation',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
    description:
      'When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check.'
  },
  {
    id: SRD_MEDICINE_SKILL_ID,
    code: 'MEDICINE',
    label: 'Medicine',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    description:
      'A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness.'
  },
  {
    id: vocabId(D.skill, 11),
    code: 'NATURE',
    label: 'Nature',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
    description:
      'Your Intelligence (Nature) check measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles.'
  },
  {
    id: vocabId(D.skill, 12),
    code: 'PERCEPTION',
    label: 'Perception',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    description:
      'Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something.'
  },
  {
    id: vocabId(D.skill, 13),
    code: 'PERFORMANCE',
    label: 'Performance',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA,
    description:
      'Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.'
  },
  {
    id: vocabId(D.skill, 14),
    code: 'PERSUASION',
    label: 'Persuasion',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA,
    description:
      'When you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask you to make a Charisma (Persuasion) check.'
  },
  {
    id: vocabId(D.skill, 15),
    code: 'RELIGION',
    label: 'Religion',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
    description:
      'Your Intelligence (Religion) check measures your ability to recall lore about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults.'
  },
  {
    id: vocabId(D.skill, 16),
    code: 'SLEIGHT_OF_HAND',
    label: 'Sleight of Hand',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    description:
      'Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check.'
  },
  {
    id: vocabId(D.skill, 17),
    code: 'STEALTH',
    label: 'Stealth',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    description:
      'Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard.'
  },
  {
    id: vocabId(D.skill, 18),
    code: 'SURVIVAL',
    label: 'Survival',
    governingAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    description:
      'The GM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other natural hazards.'
  }
]

// ─── Passives ─────────────────────────────────────────────────────────────────

export const SRD_PASSIVE_PERCEPTION_ID = vocabId(D.passive, 1)

const SRD_PASSIVES = [
  {
    id: SRD_PASSIVE_PERCEPTION_ID,
    code: 'PASSIVE_PERCEPTION',
    label: 'Passive Perception',
    description: '10 + Perception modifier.',
    skillDefinitionId: SRD_PERCEPTION_SKILL_ID,
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM
  },
  {
    id: vocabId(D.passive, 2),
    code: 'PASSIVE_INVESTIGATION',
    label: 'Passive Investigation',
    description: '10 + Investigation modifier.',
    skillDefinitionId: SRD_INVESTIGATION_SKILL_ID,
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE
  },
  {
    id: vocabId(D.passive, 3),
    code: 'PASSIVE_INSIGHT',
    label: 'Passive Insight',
    description: '10 + Insight modifier.',
    skillDefinitionId: SRD_INSIGHT_SKILL_ID,
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM
  }
]

// ─── Speeds ───────────────────────────────────────────────────────────────────

export const SRD_SPEEDS = [
  {
    id: SRD_WALK_SPEED_ID,
    code: 'WALK',
    label: 'Walking Speed',
    description: 'Base movement speed on foot.'
  },
  {
    id: vocabId(D.speed, 2),
    code: 'SWIM',
    label: 'Swimming Speed',
    description: 'Speed while swimming.'
  },
  {
    id: vocabId(D.speed, 3),
    code: 'CLIMB',
    label: 'Climbing Speed',
    description: 'Speed while climbing.'
  },
  {
    id: vocabId(D.speed, 4),
    code: 'FLY',
    label: 'Flying Speed',
    description: 'Speed while flying.'
  },
  {
    id: vocabId(D.speed, 5),
    code: 'BURROW',
    label: 'Burrowing Speed',
    description: 'Speed while burrowing.'
  }
]

// ─── Terrains ─────────────────────────────────────────────────────────────────

const SRD_TERRAINS = [
  { id: vocabId(D.terrain, 1), code: 'ARCTIC', label: 'Arctic' },
  { id: vocabId(D.terrain, 2), code: 'COAST', label: 'Coast' },
  { id: vocabId(D.terrain, 3), code: 'DESERT', label: 'Desert' },
  { id: vocabId(D.terrain, 4), code: 'FOREST', label: 'Forest' },
  { id: vocabId(D.terrain, 5), code: 'GRASSLAND', label: 'Grassland' },
  { id: vocabId(D.terrain, 6), code: 'MOUNTAIN', label: 'Mountain' },
  { id: vocabId(D.terrain, 7), code: 'SWAMP', label: 'Swamp' },
  { id: vocabId(D.terrain, 8), code: 'UNDERDARK', label: 'Underdark' },
  { id: vocabId(D.terrain, 9), code: 'UNDERWATER', label: 'Underwater' },
  { id: vocabId(D.terrain, 10), code: 'URBAN', label: 'Urban' }
]

// ─── Challenge Ratings ────────────────────────────────────────────────────────

export const SRD_CHALLENGE_RATINGS = [
  {
    id: vocabId(D.challengeRating, 1),
    code: 'CR_0',
    label: '0',
    short: 'CR 0',
    description: '0 XP',
    xp: 0,
    proficiencyBonus: 2,
    rank: 0,
    value: 0
  },
  {
    id: vocabId(D.challengeRating, 2),
    code: 'CR_1_8',
    label: '1/8',
    short: 'CR 1/8',
    description: '25 XP',
    xp: 25,
    proficiencyBonus: 2,
    rank: 1,
    value: 0.125
  },
  {
    id: vocabId(D.challengeRating, 3),
    code: 'CR_1_4',
    label: '1/4',
    short: 'CR 1/4',
    description: '50 XP',
    xp: 50,
    proficiencyBonus: 2,
    rank: 2,
    value: 0.25
  },
  {
    id: vocabId(D.challengeRating, 4),
    code: 'CR_1_2',
    label: '1/2',
    short: 'CR 1/2',
    description: '100 XP',
    xp: 100,
    proficiencyBonus: 2,
    rank: 3,
    value: 0.5
  },
  {
    id: vocabId(D.challengeRating, 5),
    code: 'CR_1',
    label: '1',
    short: 'CR 1',
    description: '200 XP',
    xp: 200,
    proficiencyBonus: 2,
    rank: 4,
    value: 1
  },
  {
    id: vocabId(D.challengeRating, 6),
    code: 'CR_2',
    label: '2',
    short: 'CR 2',
    description: '450 XP',
    xp: 450,
    proficiencyBonus: 2,
    rank: 5,
    value: 2
  },
  {
    id: vocabId(D.challengeRating, 7),
    code: 'CR_3',
    label: '3',
    short: 'CR 3',
    description: '700 XP',
    xp: 700,
    proficiencyBonus: 2,
    rank: 6,
    value: 3
  },
  {
    id: vocabId(D.challengeRating, 8),
    code: 'CR_4',
    label: '4',
    short: 'CR 4',
    description: '1100 XP',
    xp: 1100,
    proficiencyBonus: 2,
    rank: 7,
    value: 4
  },
  {
    id: vocabId(D.challengeRating, 9),
    code: 'CR_5',
    label: '5',
    short: 'CR 5',
    description: '1800 XP',
    xp: 1800,
    proficiencyBonus: 3,
    rank: 8,
    value: 5
  },
  {
    id: vocabId(D.challengeRating, 10),
    code: 'CR_6',
    label: '6',
    short: 'CR 6',
    description: '2300 XP',
    xp: 2300,
    proficiencyBonus: 3,
    rank: 9,
    value: 6
  },
  {
    id: vocabId(D.challengeRating, 11),
    code: 'CR_7',
    label: '7',
    short: 'CR 7',
    description: '2900 XP',
    xp: 2900,
    proficiencyBonus: 3,
    rank: 10,
    value: 7
  },
  {
    id: vocabId(D.challengeRating, 12),
    code: 'CR_8',
    label: '8',
    short: 'CR 8',
    description: '3900 XP',
    xp: 3900,
    proficiencyBonus: 3,
    rank: 11,
    value: 8
  },
  {
    id: vocabId(D.challengeRating, 13),
    code: 'CR_9',
    label: '9',
    short: 'CR 9',
    description: '5000 XP',
    xp: 5000,
    proficiencyBonus: 4,
    rank: 12,
    value: 9
  },
  {
    id: vocabId(D.challengeRating, 14),
    code: 'CR_10',
    label: '10',
    short: 'CR 10',
    description: '5900 XP',
    xp: 5900,
    proficiencyBonus: 4,
    rank: 13,
    value: 10
  },
  {
    id: vocabId(D.challengeRating, 15),
    code: 'CR_11',
    label: '11',
    short: 'CR 11',
    description: '7200 XP',
    xp: 7200,
    proficiencyBonus: 4,
    rank: 14,
    value: 11
  },
  {
    id: vocabId(D.challengeRating, 16),
    code: 'CR_12',
    label: '12',
    short: 'CR 12',
    description: '8400 XP',
    xp: 8400,
    proficiencyBonus: 4,
    rank: 15,
    value: 12
  },
  {
    id: vocabId(D.challengeRating, 17),
    code: 'CR_13',
    label: '13',
    short: 'CR 13',
    description: '10000 XP',
    xp: 10000,
    proficiencyBonus: 5,
    rank: 16,
    value: 13
  },
  {
    id: vocabId(D.challengeRating, 18),
    code: 'CR_14',
    label: '14',
    short: 'CR 14',
    description: '11500 XP',
    xp: 11500,
    proficiencyBonus: 5,
    rank: 17,
    value: 14
  },
  {
    id: vocabId(D.challengeRating, 19),
    code: 'CR_15',
    label: '15',
    short: 'CR 15',
    description: '13000 XP',
    xp: 13000,
    proficiencyBonus: 5,
    rank: 18,
    value: 15
  },
  {
    id: vocabId(D.challengeRating, 20),
    code: 'CR_16',
    label: '16',
    short: 'CR 16',
    description: '15000 XP',
    xp: 15000,
    proficiencyBonus: 5,
    rank: 19,
    value: 16
  },
  {
    id: vocabId(D.challengeRating, 21),
    code: 'CR_17',
    label: '17',
    short: 'CR 17',
    description: '18000 XP',
    xp: 18000,
    proficiencyBonus: 6,
    rank: 20,
    value: 17
  },
  {
    id: vocabId(D.challengeRating, 22),
    code: 'CR_18',
    label: '18',
    short: 'CR 18',
    description: '20000 XP',
    xp: 20000,
    proficiencyBonus: 6,
    rank: 21,
    value: 18
  },
  {
    id: vocabId(D.challengeRating, 23),
    code: 'CR_19',
    label: '19',
    short: 'CR 19',
    description: '22000 XP',
    xp: 22000,
    proficiencyBonus: 6,
    rank: 22,
    value: 19
  },
  {
    id: vocabId(D.challengeRating, 24),
    code: 'CR_20',
    label: '20',
    short: 'CR 20',
    description: '25000 XP',
    xp: 25000,
    proficiencyBonus: 6,
    rank: 23,
    value: 20
  },
  {
    id: vocabId(D.challengeRating, 25),
    code: 'CR_21',
    label: '21',
    short: 'CR 21',
    description: '33000 XP',
    xp: 33000,
    proficiencyBonus: 7,
    rank: 24,
    value: 21
  },
  {
    id: vocabId(D.challengeRating, 26),
    code: 'CR_22',
    label: '22',
    short: 'CR 22',
    description: '41000 XP',
    xp: 41000,
    proficiencyBonus: 7,
    rank: 25,
    value: 22
  },
  {
    id: vocabId(D.challengeRating, 27),
    code: 'CR_23',
    label: '23',
    short: 'CR 23',
    description: '50000 XP',
    xp: 50000,
    proficiencyBonus: 7,
    rank: 26,
    value: 23
  },
  {
    id: vocabId(D.challengeRating, 28),
    code: 'CR_24',
    label: '24',
    short: 'CR 24',
    description: '62000 XP',
    xp: 62000,
    proficiencyBonus: 7,
    rank: 27,
    value: 24
  },
  {
    id: vocabId(D.challengeRating, 29),
    code: 'CR_25',
    label: '25',
    short: 'CR 25',
    description: '75000 XP',
    xp: 75000,
    proficiencyBonus: 8,
    rank: 28,
    value: 25
  },
  {
    id: vocabId(D.challengeRating, 30),
    code: 'CR_26',
    label: '26',
    short: 'CR 26',
    description: '90000 XP',
    xp: 90000,
    proficiencyBonus: 8,
    rank: 29,
    value: 26
  },
  {
    id: vocabId(D.challengeRating, 31),
    code: 'CR_27',
    label: '27',
    short: 'CR 27',
    description: '105000 XP',
    xp: 105000,
    proficiencyBonus: 8,
    rank: 30,
    value: 27
  },
  {
    id: vocabId(D.challengeRating, 32),
    code: 'CR_28',
    label: '28',
    short: 'CR 28',
    description: '120000 XP',
    xp: 120000,
    proficiencyBonus: 8,
    rank: 31,
    value: 28
  },
  {
    id: vocabId(D.challengeRating, 33),
    code: 'CR_29',
    label: '29',
    short: 'CR 29',
    description: '135000 XP',
    xp: 135000,
    proficiencyBonus: 9,
    rank: 32,
    value: 29
  },
  {
    id: vocabId(D.challengeRating, 34),
    code: 'CR_30',
    label: '30',
    short: 'CR 30',
    description: '155000 XP',
    xp: 155000,
    proficiencyBonus: 9,
    rank: 33,
    value: 30
  }
]

// ─── Creature Types ───────────────────────────────────────────────────────────

export const SRD_CREATURE_TYPES = [
  {
    id: vocabId(D.creatureType, 1),
    code: 'ABERRATION',
    label: 'Aberration',
    description: 'Utterly alien beings from beyond the known planes.'
  },
  {
    id: vocabId(D.creatureType, 2),
    code: 'BEAST',
    label: 'Beast',
    description: 'Nonhumanoid creatures that are a natural part of the fantasy ecology.'
  },
  {
    id: vocabId(D.creatureType, 3),
    code: 'CELESTIAL',
    label: 'Celestial',
    description: 'Creatures native to the Upper Planes.'
  },
  {
    id: vocabId(D.creatureType, 4),
    code: 'CONSTRUCT',
    label: 'Construct',
    description: 'Made, not born — programmed or imbued with purpose.'
  },
  {
    id: vocabId(D.creatureType, 5),
    code: 'DRAGON',
    label: 'Dragon',
    description: 'Large reptilian creatures of ancient origin and tremendous power.'
  },
  {
    id: vocabId(D.creatureType, 6),
    code: 'ELEMENTAL',
    label: 'Elemental',
    description: 'Creatures native to the elemental planes.'
  },
  {
    id: vocabId(D.creatureType, 7),
    code: 'FEY',
    label: 'Fey',
    description: 'Magical creatures closely tied to the forces of nature.'
  },
  {
    id: vocabId(D.creatureType, 8),
    code: 'FIEND',
    label: 'Fiend',
    description: 'Wicked creatures from the Lower Planes.'
  },
  {
    id: vocabId(D.creatureType, 9),
    code: 'GIANT',
    label: 'Giant',
    description: 'Humanlike creatures that tower over humanoids.'
  },
  {
    id: vocabId(D.creatureType, 10),
    code: 'HUMANOID',
    label: 'Humanoid',
    description: 'The main peoples of the D&D world, both civilized and savage.'
  },
  {
    id: vocabId(D.creatureType, 11),
    code: 'MONSTROSITY',
    label: 'Monstrosity',
    description: 'Frightening creatures that are not natural and almost never benign.'
  },
  {
    id: vocabId(D.creatureType, 12),
    code: 'OOZE',
    label: 'Ooze',
    description: 'Gelatinous creatures that rarely have a fixed shape.'
  },
  {
    id: vocabId(D.creatureType, 13),
    code: 'PLANT',
    label: 'Plant',
    description: 'Vegetable creatures, not ordinary flora.'
  },
  {
    id: vocabId(D.creatureType, 14),
    code: 'UNDEAD',
    label: 'Undead',
    description: 'Once-living creatures brought to undeath through necromancy or unholy curse.'
  }
]

// ─── Full system record ───────────────────────────────────────────────────────

function srdIdByCode(entries: readonly { id: string; code: string }[], code: string): string {
  const entry = entries.find((item) => item.code === code)
  if (!entry) throw new Error(`SRD definition ${code} is missing.`)
  return entry.id
}

export const srdSystemRecord: SystemSeedRecord = {
  schemaVersion: 4,
  id: SRD_SYSTEM_ID,
  label: 'D&D 5e',
  description: 'Baseline SRD content bundle for Artificer Toolkit.',
  rulesetCode: 'dnd5e',
  rulesetVersion: '2014',
  userId: SRD_USER_ID,
  alignments: SRD_ALIGNMENTS,
  abilities: [...SRD_ABILITIES],
  challengeRatings: SRD_CHALLENGE_RATINGS,
  conditionTypes: SRD_CONDITION_TYPES,
  creatureTypes: SRD_CREATURE_TYPES,
  currencies: SRD_CURRENCIES,
  damageTypes: SRD_DAMAGE_TYPES,
  heritages: SRD_HERITAGES,
  languages: SRD_LANGUAGES,
  lifestyles: SRD_LIFESTYLES,
  magicSchools: SRD_MAGIC_SCHOOLS,
  passives: SRD_PASSIVES,
  rarities: SRD_RARITIES,
  senses: SRD_SENSES,
  skills: SRD_SKILLS,
  speeds: SRD_SPEEDS,
  terrains: SRD_TERRAINS,
  defaults: {
    damageTypeId: srdIdByCode(SRD_DAMAGE_TYPES, 'FIRE'),
    conditionTypeId: srdIdByCode(SRD_CONDITION_TYPES, 'POISONED'),
    movementTypeId: srdIdByCode(SRD_SPEEDS, 'WALK')
  },
  // The DMG's square-grid corner method; another creature gives at most half cover (PHB).
  cover: {
    tiers: [
      { code: 'HALF', label: 'Half cover', minBlockedLines: 1, bonus: 2, blocksTargeting: false },
      {
        code: 'THREE_QUARTERS',
        label: 'Three-quarters cover',
        minBlockedLines: 3,
        bonus: 5,
        blocksTargeting: false
      },
      { code: 'TOTAL', label: 'Total cover', minBlockedLines: 4, bonus: 0, blocksTargeting: true }
    ],
    creatureMaxTierCode: 'HALF'
  }
}
