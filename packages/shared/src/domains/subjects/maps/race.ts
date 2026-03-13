import {
  FEATURE_CATEGORY_REGISTRY,
  RACE_CATEGORY_REGISTRY,
  SIZE_OPTIONS,
  type SizeCode
} from '#core'
import { FEATURE_NODE_MAP } from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'
import type { RaceBaseAuthored, ParentRaceAuthored, SubraceAuthored } from '#authored'

// Base Race Node Map - Fixed with proper DSL
const baseRaceNode = buildNodeMap<RaceBaseAuthored>()
export const BASE_RACE_NODE_MAP = baseRaceNode.define('baseRace', ({ map, nodes }) => {
  const { text } = nodes
  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('quote', text(['quote'], 'Quote'))
    .set('description', text(['description'], 'Description'))
})

// Parent Race Node Map - Fixed with proper DSL
const parentRaceNode = buildNodeMap<ParentRaceAuthored>()
export const PARENT_RACE_NODE_MAP = parentRaceNode.define('parentRace', ({ map, nodes }) => {
  const { text, selectSingle } = nodes
  map
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE',
      options: SIZE_OPTIONS
    }))
})

// Subrace Node Map - Fixed with proper DSL
const subraceNode = buildNodeMap<SubraceAuthored>()
export const SUBRACE_NODE_MAP = subraceNode.define('subrace', ({ map, nodes, data }) => {
  const { text, selectSingle } = nodes
  const { table } = data
  map
    .set('parentRaceId', selectSingle(['parentRaceId'], 'Parent Race', {
      kind: 'DATA',
      relationship: table('races', {
        selectColumns: ['id', 'label'],
        where: (col) => col('category').eq('BASE')
      })
    }))
})

