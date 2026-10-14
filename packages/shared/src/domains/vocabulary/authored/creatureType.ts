import type { Vocabulary } from './vocabulary.js'

export enum CreatureTypeCode {
  ABERRATION = 'ABERRATION',
  BEAST = 'BEAST',
  CELESTIAL = 'CELESTIAL',
  CONSTRUCT = 'CONSTRUCT',
  DRAGON = 'DRAGON',
  ELEMENTAL = 'ELEMENTAL',
  FEY = 'FEY',
  FIEND = 'FIEND',
  GIANT = 'GIANT',
  HUMANOID = 'HUMANOID',
  MONSTROSITY = 'MONSTROSITY',
  OOZE = 'OOZE',
  PLANT = 'PLANT',
  UNDEAD = 'UNDEAD'
}

export type CreatureTypeOption = Vocabulary<CreatureTypeCode>

export const creatureTypes: CreatureTypeOption[] = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
    code: CreatureTypeCode.ABERRATION,
    label: 'Aberration',
    short: 'Aberr.',
    description: 'Alien entity from beyond known reality.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
    code: CreatureTypeCode.BEAST,
    label: 'Beast',
    short: 'Beast',
    description: 'Natural non-magical creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03',
    code: CreatureTypeCode.CELESTIAL,
    label: 'Celestial',
    short: 'Celes.',
    description: 'Upper Planes creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c04',
    code: CreatureTypeCode.CONSTRUCT,
    label: 'Construct',
    short: 'Constr.',
    description: 'Artificially created creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c05',
    code: CreatureTypeCode.DRAGON,
    label: 'Dragon',
    short: 'Dragon',
    description: 'Ancient reptilian creature of great power.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c06',
    code: CreatureTypeCode.ELEMENTAL,
    label: 'Elemental',
    short: 'Elem.',
    description: 'Elemental plane creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c07',
    code: CreatureTypeCode.FEY,
    label: 'Fey',
    short: 'Fey',
    description: 'Magical nature-tied creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c08',
    code: CreatureTypeCode.FIEND,
    label: 'Fiend',
    short: 'Fiend',
    description: 'Lower Planes creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c09',
    code: CreatureTypeCode.GIANT,
    label: 'Giant',
    short: 'Giant',
    description: 'Enormous humanoid creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c0a',
    code: CreatureTypeCode.HUMANOID,
    label: 'Humanoid',
    short: 'Human.',
    description: 'Bipedal humanoid creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c0b',
    code: CreatureTypeCode.MONSTROSITY,
    label: 'Monstrosity',
    short: 'Monstr.',
    description: 'Unnatural frightening creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c0c',
    code: CreatureTypeCode.OOZE,
    label: 'Ooze',
    short: 'Ooze',
    description: 'Gelatinous shapeless creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c0d',
    code: CreatureTypeCode.PLANT,
    label: 'Plant',
    short: 'Plant',
    description: 'Animate plant creature.'
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c0e',
    code: CreatureTypeCode.UNDEAD,
    label: 'Undead',
    short: 'Undead',
    description: 'Undead creature.'
  }
]
