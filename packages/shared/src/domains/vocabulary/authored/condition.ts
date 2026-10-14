import { Vocabulary } from './vocabulary.js'

export enum ConditionTypeCode {
  BLINDED = 'BLINDED',
  CHARMED = 'CHARMED',
  DEAFENED = 'DEAFENED',
  EXHAUSTION = 'EXHAUSTION',
  FRIGHTENED = 'FRIGHTENED',
  GRAPPLED = 'GRAPPLED',
  INCAPACITATED = 'INCAPACITATED',
  INVISIBLE = 'INVISIBLE',
  PARALYZED = 'PARALYZED',
  PETRIFIED = 'PETRIFIED',
  POISONED = 'POISONED',
  PRONE = 'PRONE',
  RESTRAINED = 'RESTRAINED',
  STUNNED = 'STUNNED',
  UNCONSCIOUS = 'UNCONSCIOUS'
}

export type ConditionTypeOption = Vocabulary<ConditionTypeCode>

export const conditionTypes: ConditionTypeOption[] = [
  {
    id: 'a8c8608e-a3dc-4df4-b9eb-89dceaba45d1',
    code: ConditionTypeCode.BLINDED,
    label: 'Blinded',
    description: 'Cannot see.'
  },
  {
    id: '6aa46804-276e-424c-bfa4-773cb9524049',
    code: ConditionTypeCode.CHARMED,
    label: 'Charmed',
    description: 'Magically influenced.'
  },
  {
    id: '8fbdea3b-1b28-4b4c-bc00-e001795d5baf',
    code: ConditionTypeCode.DEAFENED,
    label: 'Deafened',
    description: 'Cannot hear.'
  },
  {
    id: 'f35099a7-8a7d-4e34-a692-eb2d6f7dd1f4',
    code: ConditionTypeCode.EXHAUSTION,
    label: 'Exhaustion',
    description: 'Fatigue and strain.'
  },
  {
    id: '46cf6e8a-c23e-4537-9cc0-13a5492f796e',
    code: ConditionTypeCode.FRIGHTENED,
    label: 'Frightened',
    description: 'Overcome by fear.'
  },
  {
    id: '1edcc47e-fb7c-4636-98c2-5c3bca1989cb',
    code: ConditionTypeCode.GRAPPLED,
    label: 'Grappled',
    description: 'Movement restrained.'
  },
  {
    id: '7efc02b4-7a0b-4542-bebf-abab6e7d9f81',
    code: ConditionTypeCode.INCAPACITATED,
    label: 'Incapacitated',
    description: 'Cannot act.'
  },
  {
    id: '3eeb83b6-7634-4130-89ff-6a885efe1fd5',
    code: ConditionTypeCode.INVISIBLE,
    label: 'Invisible',
    description: 'Cannot be seen.'
  },
  {
    id: '8516d3ec-2a7a-4649-be59-06b27d222429',
    code: ConditionTypeCode.PARALYZED,
    label: 'Paralyzed',
    description: 'Frozen in place.'
  },
  {
    id: 'df418e15-3894-4596-96db-cae01fe301d9',
    code: ConditionTypeCode.PETRIFIED,
    label: 'Petrified',
    description: 'Turned to stone.'
  },
  {
    id: 'e01ba5bc-e073-445a-8a55-10a18b36e444',
    code: ConditionTypeCode.POISONED,
    label: 'Poisoned',
    description: 'Suffering poison.'
  },
  {
    id: 'afa2454f-cf3f-4bb6-9faa-10366750e347',
    code: ConditionTypeCode.PRONE,
    label: 'Prone',
    description: 'Knocked down.'
  },
  {
    id: 'b76cb480-4a7e-40c8-a41d-3e848906f9d9',
    code: ConditionTypeCode.RESTRAINED,
    label: 'Restrained',
    description: 'Bound or held.'
  },
  {
    id: '8a8b29c3-3a47-426d-b9f3-b88a4f33c33b',
    code: ConditionTypeCode.STUNNED,
    label: 'Stunned',
    description: 'Dazed.'
  },
  {
    id: '6f41fda4-064a-4a37-b848-976a101f792a',
    code: ConditionTypeCode.UNCONSCIOUS,
    label: 'Unconscious',
    description: 'Knocked out.'
  }
]
