import type { BackgroundAuthored } from '#authored'
import { FEATURE_NODE_MAP, STARTING_EQUIPMENT_NODE_MAP } from '#maps'
import type { NodeMap } from '#util'

export const BACKGROUND_NODE_MAP: NodeMap<BackgroundAuthored> = {
  label: {
    id: 'label',
    label: 'Label',
    input: { type: 'TEXT' }
  },
  description: {
    id: 'description',
    label: 'Description',
    input: { type: 'richText' }
  },
  detail: {
    id: 'details',
    label: 'Detail',
    input: { type: 'richText' }
  },
  features: {
    id: 'features',
    nodes: FEATURE_NODE_MAP
  },
  startingEquipment: {
    id: 'startingEquipment',
    nodes: STARTING_EQUIPMENT_NODE_MAP
  }
} as const
