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
    description: 'Walking represents standard ground-based movement across solid surfaces.',
    tooltip: 'Ground movement.'
  },
  {
    id: '9f6b8c2e-67ce-4fe1-b62d-a42b974c4a3c',
    code: SpeedType.CLIMBING,
    label: 'Climbing',
    description: 'Climbing represents movement along vertical or inclined surfaces.',
    tooltip: 'Vertical movement.'
  },
  {
    id: '41913c56-e81b-4297-8493-e288a4f20221',
    code: SpeedType.SWIMMING,
    label: 'Swimming',
    description: 'Swimming represents movement through liquid environments such as water.',
    tooltip: 'Movement through water.'
  },
  {
    id: 'da64da33-fde4-4eb2-8261-bc19633ad9b8',
    code: SpeedType.FLYING,
    label: 'Flying',
    description: 'Flying represents movement through the air without relying on surfaces.',
    tooltip: 'Aerial movement.'
  },
  {
    id: '1f9b5978-6c2b-4fef-8ed4-eda6a87555cc',
    code: SpeedType.BURROWING,
    label: 'Burrowing',
    description:
      'Burrowing represents movement through earth or similar materials beneath the surface.',
    tooltip: 'Underground movement.'
  }
]
