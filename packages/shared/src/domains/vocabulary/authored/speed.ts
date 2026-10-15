import type { Vocabulary } from './vocabulary.js'

export enum SpeedType {
  WALKING = 'WALKING',
  CLIMBING = 'CLIMBING',
  SWIMMING = 'SWIMMING',
  FLYING = 'FLYING',
  BURROWING = 'BURROWING'
}

export type SpeedTypeOption = Vocabulary<SpeedType>

export const speedOptions: SpeedTypeOption[] = [
  {
    id: '1bd431c3-1556-49ee-b384-3cf04a734a47',
    code: SpeedType.WALKING,
    label: 'Walking',
    description: 'Ground movement.'
  },
  {
    id: '9f6b8c2e-67ce-4fe1-b62d-a42b974c4a3c',
    code: SpeedType.CLIMBING,
    label: 'Climbing',
    description: 'Vertical movement.'
  },
  {
    id: '41913c56-e81b-4297-8493-e288a4f20221',
    code: SpeedType.SWIMMING,
    label: 'Swimming',
    description: 'Movement through water.'
  },
  {
    id: 'da64da33-fde4-4eb2-8261-bc19633ad9b8',
    code: SpeedType.FLYING,
    label: 'Flying',
    description: 'Aerial movement.'
  },
  {
    id: '1f9b5978-6c2b-4fef-8ed4-eda6a87555cc',
    code: SpeedType.BURROWING,
    label: 'Burrowing',
    description: 'Underground movement.'
  }
]
