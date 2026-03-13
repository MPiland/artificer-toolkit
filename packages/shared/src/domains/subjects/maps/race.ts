import { RACE_CATEGORY_CODE, SIZE_OPTIONS } from '#core'
import { FEATURE_NODE_MAP, SPEED_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'
import type {
  DetailAuthored,
  RaceAncestryAuthored,
  RaceAncestryOptionAuthored,
  RaceAuthored
} from '#authored'

const detailNode = buildNodeMap<DetailAuthored>()

const DETAIL_NODE_MAP = detailNode.define('raceDetail', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const ancestryOptionNode = buildNodeMap<RaceAncestryOptionAuthored>()

const RACE_ANCESTRY_OPTION_NODE_MAP = ancestryOptionNode.define('raceAncestryOption', ({ map, nodes }) => {
  const { text, number, groupArray } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
})

const ancestryNode = buildNodeMap<RaceAncestryAuthored>()

const RACE_ANCESTRY_NODE_MAP = ancestryNode.define('raceAncestry', ({ map, nodes }) => {
  const { text, groupArray } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('options', groupArray(['options'], 'Options', () => RACE_ANCESTRY_OPTION_NODE_MAP))
})

const raceNode = buildNodeMap<RaceAuthored>()

export const RACE_NODE_MAP = raceNode.define('race', ({ map, nodes, cond, data, logic }) => {
  const { text, number, selectSingle, groupArray, groupObject } = nodes
  const local = cond.local()
  const { not } = logic
  const { table } = data

  const isBaseRace = local.field(['category']).eq(RACE_CATEGORY_CODE.BASE)
  const isSubrace = local.field(['category']).eq(RACE_CATEGORY_CODE.SUBRACE)

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('quote', text(['quote'], 'Quote'))
    .set('description', text(['description'], 'Description'))
    .set('details', groupArray(['details'], 'Details', () => DETAIL_NODE_MAP))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: [
        { code: RACE_CATEGORY_CODE.BASE, label: 'Base Race' },
        { code: RACE_CATEGORY_CODE.SUBRACE, label: 'Subrace' }
      ]
    }))
    .set('playable', text(['playable'], 'Playable', {
      showIf: isBaseRace
    }))
    .set('ancestry', groupObject(['ancestry'], 'Ancestry', () => RACE_ANCESTRY_NODE_MAP, {
      showIf: isBaseRace
    }))
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE',
      options: SIZE_OPTIONS
    }, {
      showIf: not(local.field(['category']).empty())
    }))
    .set('speeds', groupArray(['speeds'], 'Speeds', () => SPEED_NODE_MAP, {
      showIf: not(local.field(['category']).empty())
    }))
    .set('parentRaceId', selectSingle(['parentRaceId'], 'Parent Race', {
      kind: 'DATA',
      relationship: table('races', {
        selectColumns: ['id', 'label'],
        where: (col) => col('category').eq('BASE')
      })
    }, {
      showIf: isSubrace
    }))
})
