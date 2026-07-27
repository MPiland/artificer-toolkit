import type { BackgroundAuthored, DetailAuthored } from '#authored'
import {
  FEATURE_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  STARTING_EQUIPMENT_ITEM_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP
} from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'

const BACKGROUND_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  details: { id: 'details', label: 'Details', order: 20 },
  grants: { id: 'grants', label: 'Grants', order: 30 },
  features: { id: 'features', label: 'Features', order: 40 },
  equipment: { id: 'equipment', label: 'Starting Equipment', order: 50 }
} as const

const DETAIL_SECTIONS = {
  details: { id: 'details', label: 'Details', order: 10 }
} as const

const detailNode = buildNodeMap<DetailAuthored>()

export const BACKGROUND_DETAIL_NODE_MAP = detailNode.define(
  'backgroundDetail',
  ({ map, nodes }) => {
    const { text, richText, number } = nodes

    map
      .set('label', text(['label'], 'Name', { section: DETAIL_SECTIONS.details, order: 10 }))
      .set(
        'description',
        richText(['description'], 'Description', { section: DETAIL_SECTIONS.details, order: 20 })
      )
      .set('order', number(['order'], 'Order', { section: DETAIL_SECTIONS.details, order: 30 }))
  }
)

const background = buildNodeMap<BackgroundAuthored>()

export const BACKGROUND_PROFICIENCY_NODE_MAP = PROFICIENCY_NODE_MAP as NodeMap<
  NonNullable<BackgroundAuthored['proficiencies']>[number]
>
export const BACKGROUND_STARTING_EQUIPMENT_ITEM_NODE_MAP =
  STARTING_EQUIPMENT_ITEM_NODE_MAP as NodeMap<
    NonNullable<
      BackgroundAuthored['startingEquipment']
    >['sets'][number]['groups'][number]['options'][number]['items'][number]
  >

export const BACKGROUND_NODE_MAP: NodeMap<BackgroundAuthored> = background.define(
  'background',
  ({ map, nodes }) => {
    const { text, richText, groupArray, groupObject } = nodes

    map
      .set('kind', text(['kind'], 'Kind', { authoring: { exposure: 'system' } }))
      .set('id', text(['id'], 'ID'))
      .set(
        'label',
        text(['label'], 'Name', {
          section: BACKGROUND_SECTIONS.basics,
          order: 10,
          requiredIf: true
        })
      )
      .set(
        'description',
        richText(['description'], 'Description', { section: BACKGROUND_SECTIONS.basics, order: 20 })
      )
      .set(
        'details',
        groupArray(['details'], 'Details', () => BACKGROUND_DETAIL_NODE_MAP, {
          presentation: 'inline',
          section: BACKGROUND_SECTIONS.details,
          order: 10
        })
      )
      .set(
        'proficiencies',
        groupArray(['proficiencies'], 'Proficiencies', () => BACKGROUND_PROFICIENCY_NODE_MAP, {
          presentation: 'focused',
          section: BACKGROUND_SECTIONS.grants,
          order: 10
        })
      )
      .set(
        'features',
        groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, {
          presentation: 'branch',
          section: BACKGROUND_SECTIONS.features,
          order: 10
        })
      )
      .set(
        'startingEquipment',
        groupObject(
          ['startingEquipment'],
          'Starting Equipment',
          () => STARTING_EQUIPMENT_NODE_MAP,
          { presentation: 'branch', section: BACKGROUND_SECTIONS.equipment, order: 10 }
        )
      )
      .set('userId', text(['userId'], 'User ID'))
      .set('systemId', text(['systemId'], 'System ID'))
  }
)
