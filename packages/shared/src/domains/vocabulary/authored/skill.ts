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
    description: 'Balance and agile movement.'
  },
  {
    id: 'e4a964eb-b60a-4ede-a00b-a8273d6755da',
    code: SkillCode.ANIMAL_HANDLING,
    label: 'Animal Handling',
    description: 'Interacting with animals.'
  },
  {
    id: 'adae085d-1a71-4237-a074-6eae902408a2',
    code: SkillCode.ARCANA,
    label: 'Arcana',
    description: 'Knowledge of magic.'
  },
  {
    id: '94f0dbc2-cd93-420c-be04-e558ed23e7b9',
    code: SkillCode.ATHLETICS,
    label: 'Athletics',
    description: 'Physical exertion.'
  },
  {
    id: '85551692-3026-48f2-9d4c-cfa3bd20d728',
    code: SkillCode.DECEPTION,
    label: 'Deception',
    description: 'Misleading others.'
  },
  {
    id: '83c79ea1-6071-44a7-84df-b32a3d6ec25a',
    code: SkillCode.HISTORY,
    label: 'History',
    description: 'Knowledge of the past.'
  },
  {
    id: 'a8b2990b-09b4-4784-9dc5-710a69274f43',
    code: SkillCode.INSIGHT,
    label: 'Insight',
    description: 'Reading intentions.'
  },
  {
    id: 'fddbd476-f445-4e22-ba0b-f6f383c4c77b',
    code: SkillCode.INTIMIDATION,
    label: 'Intimidation',
    description: 'Coercive influence.'
  },
  {
    id: 'cf695c5b-bcce-428a-aa87-0c6b98bdd0ee',
    code: SkillCode.INVESTIGATION,
    label: 'Investigation',
    description: 'Finding clues.'
  },
  {
    id: 'd264b4e1-167c-4e65-a048-4bef9dfe01a5',
    code: SkillCode.MEDICINE,
    label: 'Medicine',
    description: 'Treating injuries.'
  },
  {
    id: 'feb64a45-36b7-4d8d-bc0f-38c198d5a77d',
    code: SkillCode.NATURE,
    label: 'Nature',
    description: 'Knowledge of nature.'
  },
  {
    id: '1e245c7a-84de-458f-b701-1167e070a591',
    code: SkillCode.PERCEPTION,
    label: 'Perception',
    description: 'Noticing details.'
  },
  {
    id: '7035e147-64a0-4025-8d68-1aa14da72962',
    code: SkillCode.PERFORMANCE,
    label: 'Performance',
    description: 'Entertaining others.'
  },
  {
    id: 'a8adcc9e-8359-491e-8ae0-085f8f254a3f',
    code: SkillCode.PERSUASION,
    label: 'Persuasion',
    description: 'Diplomatic influence.'
  },
  {
    id: 'a8a42ff0-741f-4ffb-8ed4-e8583eca4a75',
    code: SkillCode.RELIGION,
    label: 'Religion',
    description: 'Knowledge of religion.'
  },
  {
    id: 'd272c5a8-3f4c-4286-9d23-ec6a4825f1d2',
    code: SkillCode.SLEIGHT_OF_HAND,
    label: 'Sleight of Hand',
    description: 'Manual trickery.'
  },
  {
    id: '80ce3b5c-f01a-43cd-88cb-e75a6079158c',
    code: SkillCode.STEALTH,
    label: 'Stealth',
    description: 'Avoiding notice.'
  },
  {
    id: '81fba5cb-32d5-4e0e-97ed-46ad83ddfed7',
    code: SkillCode.SURVIVAL,
    label: 'Survival',
    description: 'Wilderness skills.'
  }
]
