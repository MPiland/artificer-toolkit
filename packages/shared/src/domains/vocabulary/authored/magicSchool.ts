import type { Vocabulary } from './vocabulary.js'

export enum MagicSchoolCode {
  ABJURATION = 'ABJURATION',
  CONJURATION = 'CONJURATION',
  DIVINATION = 'DIVINATION',
  ENCHANTMENT = 'ENCHANTMENT',
  EVOCATION = 'EVOCATION',
  ILLUSION = 'ILLUSION',
  NECROMANCY = 'NECROMANCY',
  TRANSMUTATION = 'TRANSMUTATION'
}

export type MagicSchoolOption = Vocabulary<MagicSchoolCode>

export const magicSchools: MagicSchoolOption[] = [
  {
    id: '0aa87b3c-ba8b-4829-a360-47b7175175f7',
    code: MagicSchoolCode.ABJURATION,
    label: 'Abjuration',
    description:
      'Abjuration magic focuses on protection, warding, and negation of harmful effects.',
    tooltip: 'Protective magic.'
  },
  {
    id: 'a8859680-a4cd-471c-9f92-09ed8fe8e236',
    code: MagicSchoolCode.CONJURATION,
    label: 'Conjuration',
    description:
      'Conjuration magic involves summoning creatures, objects, or energies from elsewhere.',
    tooltip: 'Summoning magic.'
  },
  {
    id: '808193a8-c0b6-4b8f-a713-133e3ed383fa',
    code: MagicSchoolCode.DIVINATION,
    label: 'Divination',
    description: 'Divination magic reveals information, foresight, or hidden knowledge.',
    tooltip: 'Information magic.'
  },
  {
    id: 'bb0a85c4-bd0b-4dea-891c-3eb89228d7b3',
    code: MagicSchoolCode.ENCHANTMENT,
    label: 'Enchantment',
    description: 'Enchantment magic influences the thoughts, emotions, or actions of creatures.',
    tooltip: 'Mind-affecting magic.'
  },
  {
    id: 'c63f84d1-d67f-4f04-aac6-9e918a059ff9',
    code: MagicSchoolCode.EVOCATION,
    label: 'Evocation',
    description:
      'Evocation magic channels elemental or raw magical energy to create powerful effects.',
    tooltip: 'Energy magic.'
  },
  {
    id: '84021b71-cef1-4efd-afea-1de784e3c47c',
    code: MagicSchoolCode.ILLUSION,
    label: 'Illusion',
    description:
      'Illusion magic creates false images, sounds, or sensations to deceive the senses.',
    tooltip: 'Deceptive magic.'
  },
  {
    id: '4c8ba19d-ae62-4cc7-9360-7b1730e8cafc',
    code: MagicSchoolCode.NECROMANCY,
    label: 'Necromancy',
    description: 'Necromancy magic manipulates life force, death, and undeath.',
    tooltip: 'Life and death magic.'
  },
  {
    id: '2506e4f1-6fa1-419e-af73-72cb8980aedd',
    code: MagicSchoolCode.TRANSMUTATION,
    label: 'Transmutation',
    description:
      'Transmutation magic alters the physical properties or form of creatures and objects.',
    tooltip: 'Transformative magic.'
  }
]
