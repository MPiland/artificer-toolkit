import type { Vocabulary } from './vocabulary.js'

export enum LanguageCode {
  ABYSSAL = 'ABYSSAL',
  CELESTIAL = 'CELESTIAL',
  COMMON = 'COMMON',
  DEEP_SPEECH = 'DEEP_SPEECH',
  DRACONIC = 'DRACONIC',
  DWARVISH = 'DWARVISH',
  ELVISH = 'ELVISH',
  GIANT = 'GIANT',
  GNOMISH = 'GNOMISH',
  GOBLIN = 'GOBLIN',
  HALFLING = 'HALFLING',
  INFERNAL = 'INFERNAL',
  ORC = 'ORC',
  PRIMORDIAL = 'PRIMORDIAL',
  SYLVAN = 'SYLVAN',
  UNDERCOMMON = 'UNDERCOMMON'
}

export type LanguageOption = Vocabulary<LanguageCode>

export const languages: LanguageOption[] = [
  {
    id: '9d5d6911-a1ea-41e3-ad6a-e5caed184456',
    code: LanguageCode.COMMON,
    label: 'Common',
    description: 'Common is the most widely spoken language among humanoids across many cultures.',
    tooltip: 'Widely spoken.'
  },
  {
    id: '5cc2a251-e841-4516-9b9e-89b9478a39d9',
    code: LanguageCode.DWARVISH,
    label: 'Dwarvish',
    description: 'Dwarvish is the language of dwarves, known for its harsh consonants and runic script.',
    tooltip: 'Language of dwarves.'
  },
  {
    id: 'fcf7df00-0e90-49c0-aec2-18eac9e0e57b',
    code: LanguageCode.ELVISH,
    label: 'Elvish',
    description: 'Elvish is a flowing and melodic language spoken by elves and closely tied to their culture.',
    tooltip: 'Language of elves.'
  },
  {
    id: '8bc00341-8cc0-440c-aea4-6acb06b51310',
    code: LanguageCode.GIANT,
    label: 'Giant',
    description: 'Giant is a powerful language spoken by giants and related creatures.',
    tooltip: 'Language of giants.'
  },
  {
    id: 'fa832eda-7fed-4f44-9911-ca5f6211fb76',
    code: LanguageCode.GNOMISH,
    label: 'Gnomish',
    description: 'Gnomish is a language known for its technical vocabulary and playful complexity.',
    tooltip: 'Language of gnomes.'
  },
  {
    id: '99795372-a18e-41df-84b5-6c82881be233',
    code: LanguageCode.GOBLIN,
    label: 'Goblin',
    description: 'Goblin is a harsh language spoken by goblinoid creatures.',
    tooltip: 'Language of goblinoids.'
  },
  {
    id: '2c482343-0064-4bb8-b943-e831c14b677b',
    code: LanguageCode.HALFLING,
    label: 'Halfling',
    description: 'Halfling is the language of halflings, often spoken alongside Common.',
    tooltip: 'Language of halflings.'
  },
  {
    id: 'd4c1525b-4b88-44d6-9c0b-b1e5794d3e77',
    code: LanguageCode.ORC,
    label: 'Orc',
    description: 'Orc is a guttural language spoken by orcs and related humanoids.',
    tooltip: 'Language of orcs.'
  },
  {
    id: '7e666a17-cb39-4e53-9e0b-9f8dc5db5d63',
    code: LanguageCode.DRACONIC,
    label: 'Draconic',
    description: 'Draconic is an ancient language associated with dragons and arcane magic.',
    tooltip: 'Language of dragons.'
  },
  {
    id: 'e0bb1bca-7240-4589-9af6-21081512b593',
    code: LanguageCode.ABYSSAL,
    label: 'Abyssal',
    description: 'Abyssal is the language of demons and the Abyss, filled with harsh and chaotic sounds.',
    tooltip: 'Language of demons.'
  },
  {
    id: 'df1fee26-78a1-4410-8a35-f217e001c718',
    code: LanguageCode.INFERNAL,
    label: 'Infernal',
    description: 'Infernal is the precise and formal language of devils and the Nine Hells.',
    tooltip: 'Language of devils.'
  },
  {
    id: '59bbdaa2-5e90-45e2-88ab-71f65417bca7',
    code: LanguageCode.CELESTIAL,
    label: 'Celestial',
    description: 'Celestial is the radiant language of angels and other heavenly beings.',
    tooltip: 'Language of celestials.'
  },
  {
    id: '8f8fd340-220c-4a0f-b67e-88e72fa9a6b6',
    code: LanguageCode.PRIMORDIAL,
    label: 'Primordial',
    description: 'Primordial is the ancient language of elementals and the elemental planes.',
    tooltip: 'Language of elementals.'
  },
  {
    id: '6419c2dc-a2cb-4ff1-9732-2a53018ee633',
    code: LanguageCode.SYLVAN,
    label: 'Sylvan',
    description: 'Sylvan is a musical language spoken by fey creatures and tied to the natural world.',
    tooltip: 'Language of the fey.'
  },
  {
    id: '75f3cb04-6147-4d22-8aaf-bd5004a0ce57',
    code: LanguageCode.UNDERCOMMON,
    label: 'Undercommon',
    description: 'Undercommon is a trade language used in subterranean societies.',
    tooltip: 'Underdark trade language.'
  },
  {
    id: '8e5d3f61-ba37-434e-b4e7-bfaa3649c591',
    code: LanguageCode.DEEP_SPEECH,
    label: 'Deep Speech',
    description: 'Deep Speech is a strange and alien language associated with aberrations.',
    tooltip: 'Language of aberrations.'
  }
]
