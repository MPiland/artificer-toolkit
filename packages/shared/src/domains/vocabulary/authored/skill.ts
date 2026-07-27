import type { Vocabulary } from './vocabulary.js'

export enum SkillCode {
  ACROBATICS = 'ACROBATICS',
  ANIMAL_HANDLING = 'ANIMAL_HANDLING',
  ARCANA = 'ARCANA',
  ATHLETICS = 'ATHLETICS',
  DECEPTION = 'DECEPTION',
  HISTORY = 'HISTORY',
  INSIGHT = 'INSIGHT',
  INTIMIDATION = 'INTIMIDATION',
  INVESTIGATION = 'INVESTIGATION',
  MEDICINE = 'MEDICINE',
  NATURE = 'NATURE',
  PERCEPTION = 'PERCEPTION',
  PERFORMANCE = 'PERFORMANCE',
  PERSUASION = 'PERSUASION',
  RELIGION = 'RELIGION',
  SLEIGHT_OF_HAND = 'SLEIGHT_OF_HAND',
  STEALTH = 'STEALTH',
  SURVIVAL = 'SURVIVAL'
}

export type SkillOption = Vocabulary<SkillCode>

export const skills: SkillOption[] = [
  {
    id: 'c2e25470-7bf0-4619-ae74-dd0c5478bf19',
    code: SkillCode.ACROBATICS,
    label: 'Acrobatics',
    description:
      'Acrobatics represents balance, agility, and the ability to perform controlled physical movement.',
    tooltip: 'Balance and agile movement.'
  },
  {
    id: 'e4a964eb-b60a-4ede-a00b-a8273d6755da',
    code: SkillCode.ANIMAL_HANDLING,
    label: 'Animal Handling',
    description:
      'Animal Handling represents the ability to calm, train, or intuit the behavior of animals.',
    tooltip: 'Interacting with animals.'
  },
  {
    id: 'adae085d-1a71-4237-a074-6eae902408a2',
    code: SkillCode.ARCANA,
    label: 'Arcana',
    description:
      'Arcana represents knowledge of magic, spells, magical traditions, and arcane symbols.',
    tooltip: 'Knowledge of magic.'
  },
  {
    id: '94f0dbc2-cd93-420c-be04-e558ed23e7b9',
    code: SkillCode.ATHLETICS,
    label: 'Athletics',
    description:
      'Athletics represents physical feats involving strength, such as climbing, jumping, and swimming.',
    tooltip: 'Physical exertion.'
  },
  {
    id: '85551692-3026-48f2-9d4c-cfa3bd20d728',
    code: SkillCode.DECEPTION,
    label: 'Deception',
    description: 'Deception represents the ability to mislead, lie, or conceal the truth.',
    tooltip: 'Misleading others.'
  },
  {
    id: '83c79ea1-6071-44a7-84df-b32a3d6ec25a',
    code: SkillCode.HISTORY,
    label: 'History',
    description: 'History represents knowledge of past events, civilizations, wars, and legends.',
    tooltip: 'Knowledge of the past.'
  },
  {
    id: 'a8b2990b-09b4-4784-9dc5-710a69274f43',
    code: SkillCode.INSIGHT,
    label: 'Insight',
    description:
      'Insight represents the ability to read intentions, detect lies, and understand motivations.',
    tooltip: 'Reading intentions.'
  },
  {
    id: 'fddbd476-f445-4e22-ba0b-f6f383c4c77b',
    code: SkillCode.INTIMIDATION,
    label: 'Intimidation',
    description:
      'Intimidation represents the ability to influence others through threats or force of presence.',
    tooltip: 'Coercive influence.'
  },
  {
    id: 'cf695c5b-bcce-428a-aa87-0c6b98bdd0ee',
    code: SkillCode.INVESTIGATION,
    label: 'Investigation',
    description:
      'Investigation represents the ability to search for clues and draw conclusions from evidence.',
    tooltip: 'Finding clues.'
  },
  {
    id: 'd264b4e1-167c-4e65-a048-4bef9dfe01a5',
    code: SkillCode.MEDICINE,
    label: 'Medicine',
    description:
      'Medicine represents knowledge of injuries, illnesses, and stabilizing the wounded.',
    tooltip: 'Treating injuries.'
  },
  {
    id: 'feb64a45-36b7-4d8d-bc0f-38c198d5a77d',
    code: SkillCode.NATURE,
    label: 'Nature',
    description: 'Nature represents knowledge of terrain, plants, animals, and natural cycles.',
    tooltip: 'Knowledge of nature.'
  },
  {
    id: '1e245c7a-84de-458f-b701-1167e070a591',
    code: SkillCode.PERCEPTION,
    label: 'Perception',
    description:
      'Perception represents awareness of surroundings through sight, sound, and other senses.',
    tooltip: 'Noticing details.'
  },
  {
    id: '7035e147-64a0-4025-8d68-1aa14da72962',
    code: SkillCode.PERFORMANCE,
    label: 'Performance',
    description:
      'Performance represents the ability to entertain through music, acting, or other artistic expression.',
    tooltip: 'Entertaining others.'
  },
  {
    id: 'a8adcc9e-8359-491e-8ae0-085f8f254a3f',
    code: SkillCode.PERSUASION,
    label: 'Persuasion',
    description:
      'Persuasion represents the ability to influence others through diplomacy and reason.',
    tooltip: 'Diplomatic influence.'
  },
  {
    id: 'a8a42ff0-741f-4ffb-8ed4-e8583eca4a75',
    code: SkillCode.RELIGION,
    label: 'Religion',
    description:
      'Religion represents knowledge of deities, rites, religious traditions, and theology.',
    tooltip: 'Knowledge of religion.'
  },
  {
    id: 'd272c5a8-3f4c-4286-9d23-ec6a4825f1d2',
    code: SkillCode.SLEIGHT_OF_HAND,
    label: 'Sleight of Hand',
    description:
      'Sleight of Hand represents manual dexterity used for subtle manipulation or concealment.',
    tooltip: 'Manual trickery.'
  },
  {
    id: '80ce3b5c-f01a-43cd-88cb-e75a6079158c',
    code: SkillCode.STEALTH,
    label: 'Stealth',
    description: 'Stealth represents the ability to move quietly and avoid detection.',
    tooltip: 'Avoiding notice.'
  },
  {
    id: '81fba5cb-32d5-4e0e-97ed-46ad83ddfed7',
    code: SkillCode.SURVIVAL,
    label: 'Survival',
    description: 'Survival represents the ability to endure in the wilderness and track creatures.',
    tooltip: 'Wilderness skills.'
  }
]
