import type { Vocabulary } from './vocabulary.js'

export enum DamageTypeCode {
  ACID = 'ACID',
  BLUDGEONING = 'BLUDGEONING',
  COLD = 'COLD',
  FIRE = 'FIRE',
  FORCE = 'FORCE',
  HEALING = 'HEALING',
  LIGHTNING = 'LIGHTNING',
  NECROTIC = 'NECROTIC',
  PIERCING = 'PIERCING',
  POISON = 'POISON',
  PSYCHIC = 'PSYCHIC',
  RADIANT = 'RADIANT',
  SLASHING = 'SLASHING',
  THUNDER = 'THUNDER'
}

export type DamageTypeOption = Vocabulary<DamageTypeCode>

export const damageTypes: DamageTypeOption[] = [
  {
    id: 'b6d6f0d1-2c9c-4b61-8f6a-8f6f5e8f5a01',
    code: DamageTypeCode.ACID,
    label: 'Acid',
    short: 'Acid',
    description: 'Corrosive damage.'
  },
  {
    id: 'e2f93d6a-3e6c-4c0f-b9b7-4f2aafdf2a02',
    code: DamageTypeCode.BLUDGEONING,
    label: 'Bludgeoning',
    short: 'Bludgeon',
    description: 'Damage from blunt force.'
  },
  {
    id: '9cdd8e1e-6d44-4a8f-9c0a-8c5d63d4a303',
    code: DamageTypeCode.COLD,
    label: 'Cold',
    short: 'Cold',
    description: 'Damage from extreme cold.'
  },
  {
    id: '6a5c2c2b-8c4f-4e51-9a62-8d9a5b1b4a04',
    code: DamageTypeCode.FIRE,
    label: 'Fire',
    short: 'Fire',
    description: 'Damage from fire or heat.'
  },
  {
    id: 'a8d9b1a5-0f93-4c9d-9e47-7a8e1c4d5a05',
    code: DamageTypeCode.FORCE,
    label: 'Force',
    short: 'Force',
    description: 'Pure magical energy damage.'
  },
  {
    id: 'f1b8c6a4-7d92-4f83-9c8a-5b6a2d3e4a06',
    code: DamageTypeCode.HEALING,
    label: 'Healing',
    short: 'Heal',
    description: 'Restorative energy.'
  },
  {
    id: 'd7a3f5e9-1c2b-4e8f-b1c7-9d8e7a6b5a07',
    code: DamageTypeCode.LIGHTNING,
    label: 'Lightning',
    short: 'Lightning',
    description: 'Electrical damage.'
  },
  {
    id: 'c5a9d8e7-4b6c-4d8f-a7b1-2e3c4d5e6a08',
    code: DamageTypeCode.NECROTIC,
    label: 'Necrotic',
    short: 'Necrotic',
    description: 'Life-draining damage.'
  },
  {
    id: '8a7b6c5d-4e3f-4a2b-9c8d-7e6f5a4b3a09',
    code: DamageTypeCode.PIERCING,
    label: 'Piercing',
    short: 'Pierce',
    description: 'Puncturing damage.'
  },
  {
    id: '3e4f5a6b-7c8d-4a9b-b1c2-d3e4f5a6b0a0',
    code: DamageTypeCode.POISON,
    label: 'Poison',
    short: 'Poison',
    description: 'Toxic damage.'
  },
  {
    id: '9a8b7c6d-5e4f-4a3b-8c7d-6e5f4a3b2a0b',
    code: DamageTypeCode.PSYCHIC,
    label: 'Psychic',
    short: 'Psychic',
    description: 'Mental damage.'
  },
  {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4a0c',
    code: DamageTypeCode.RADIANT,
    label: 'Radiant',
    short: 'Radiant',
    description: 'Divine energy damage.'
  },
  {
    id: '4b3a2c1d-0e9f-4a8b-7c6d-5e4f3a2b1a0d',
    code: DamageTypeCode.SLASHING,
    label: 'Slashing',
    short: 'Slash',
    description: 'Cutting damage.'
  },
  {
    id: '5e6f7a8b-9c0d-4a1b-2c3d-4e5f6a7b8a0e',
    code: DamageTypeCode.THUNDER,
    label: 'Thunder',
    short: 'Thunder',
    description: 'Concussive sound damage.'
  }
]
