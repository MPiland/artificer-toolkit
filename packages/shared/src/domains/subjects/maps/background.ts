import type { BackgroundAuthored, DetailAuthored } from '#authored'
import { FEATURE_NODE_MAP, PROFICIENCY_NODE_MAP, STARTING_EQUIPMENT_NODE_MAP } from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'

const detailNode = buildNodeMap<DetailAuthored>()

const DETAIL_NODE_MAP = detailNode.define('detail', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const background = buildNodeMap<BackgroundAuthored>()

export const BACKGROUND_NODE_MAP: NodeMap<BackgroundAuthored> = background.define('background', ({ map, nodes }) => {
  const { text, richText, groupArray, groupObject } = nodes

  map
    .set('kind', text(['kind'], 'Kind'))
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', richText(['description'], 'Description'))
    .set('details', groupArray(['details'], 'Details', () => DETAIL_NODE_MAP))
    .set('proficiencies', groupArray(['proficiencies'], 'Proficiencies', () => PROFICIENCY_NODE_MAP))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
    .set('startingEquipment', groupObject(['startingEquipment'], 'Starting Equipment', () => STARTING_EQUIPMENT_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
})
