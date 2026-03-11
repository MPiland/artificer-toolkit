import type { BackgroundAuthored } from '#authored'
import { FEATURE_NODE_MAP, STARTING_EQUIPMENT_NODE_MAP } from '#maps'
import type { NodeMap } from '#utils'

export const BACKGROUND_NODE_MAP = {
  label: {
    label: 'Label',
    input: { type: 'TEXT' }
  },
  description: {
    label: 'Description',
    input: { type: 'richText' }
  },
  detail: {
    label: 'Detail',
    input: { type: 'richText' }
  },
  features: {
    id: 'features',
    nodes: FEATURE_NODE_MAP
  },
  startingEquipment: {
    nodes: STARTING_EQUIPMENT_NODE_MAP
  }
} as const
