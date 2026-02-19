import { ABILITY_CODE } from '#core'
import type { Vocabulary } from './vocabulary.js'

export enum PassiveCode {
  INSIGHT = 'INSIGHT',
  INVESTIGATION = 'INVESTIGATION',
  PERCEPTION = 'PERCEPTION',
  WISDOM = 'WISDOM'
}

export type PassiveOption = Vocabulary<PassiveCode> & {
  ability: keyof typeof ABILITY_CODE
}

export const passives: PassiveOption[] = [
  {
    id: 'f521e94b-962a-44ca-9104-63cd60712bcd',
    label: 'Wisdom',
    code: PassiveCode.WISDOM,
    ability: 'WISDOM'
  },
  {
    id: '34f99384-ae6a-4914-87ba-7a4c787c05df',
    label: 'Insight',
    code: PassiveCode.INSIGHT,
    ability: 'WISDOM'
  },
  {
    id: '3ceecabc-ab94-4418-99c6-18e64e32b9b6',
    label: 'Perception',
    code: PassiveCode.PERCEPTION,
    ability: 'WISDOM'
  },
  {
    id: '1b1b5f1e-4428-4e7f-9df2-5b2000171d12',
    label: 'Investigation',
    code: PassiveCode.INVESTIGATION,
    ability: 'WISDOM'
  }
]
