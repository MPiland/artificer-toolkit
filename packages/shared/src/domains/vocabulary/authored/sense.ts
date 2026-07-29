import type { Vocabulary } from './vocabulary.js'

export enum SenseCode {
  BLINDSIGHT = 'BLINDSIGHT',
  DARKVISION = 'DARKVISION',
  TREMORSENSE = 'TREMORSENSE',
  TRUESIGHT = 'TRUESIGHT'
}

export type SenseOption = Vocabulary<SenseCode>

export const senses: SenseOption[] = [
  {
    id: '2b7dd0e1-285a-4c52-a273-192ca7a7adcd',
    code: SenseCode.BLINDSIGHT,
    label: 'Blindsight',
    description:
      'Blindsight allows a creature to perceive its surroundings without relying on sight.',
    tooltip: 'Perceive without sight.'
  },
  {
    id: '0142c085-657a-499e-aea3-8630480a0f1e',
    code: SenseCode.DARKVISION,
    label: 'Darkvision',
    description: 'Darkvision allows a creature to see in darkness as if it were dim light.',
    tooltip: 'See in darkness.'
  },
  {
    id: '5fc8349a-7142-4f7f-b502-403033d258e7',
    code: SenseCode.TREMORSENSE,
    label: 'Tremorsense',
    description: 'Tremorsense allows a creature to detect vibrations through solid surfaces.',
    tooltip: 'Detect vibrations.'
  },
  {
    id: 'c79ddb7e-eb6b-4f77-ab14-a5f67c27f011',
    code: SenseCode.TRUESIGHT,
    label: 'Truesight',
    description: 'Truesight allows a creature to perceive the true form of creatures and objects.',
    tooltip: 'See true forms.'
  }
]
