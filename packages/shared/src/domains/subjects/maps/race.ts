import {
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE_OPTIONS,
  SIZE_OPTIONS
} from '#core'
import { FEATURE_NODE_MAP, SPEED_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'
import type {
  DetailAuthored,
  RaceAncestryAuthored,
  RaceAncestryOptionAuthored,
  RaceAuthored
} from '#authored'

const RACE_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  classification: { id: 'classification', label: 'Classification', order: 20 },
  ancestry: { id: 'ancestry', label: 'Ancestry', order: 30 },
  traits: { id: 'traits', label: 'Traits', order: 40 },
  features: { id: 'features', label: 'Features', order: 50 }
} as const

const detailNode = buildNodeMap<DetailAuthored>()

export const RACE_DETAIL_NODE_MAP = detailNode.define('raceDetail', ({ map, nodes }) => {
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
  const { text, number, selectSingle, selectMulti, groupArray, groupObject } = nodes
  const local = cond.local()
  const { table } = data

  const isBaseRace = local.field(['category']).eq(RACE_CATEGORY_CODE.BASE)
  const isSubrace = local.field(['category']).eq(RACE_CATEGORY_CODE.SUBRACE)

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Name', {
      section: RACE_SECTIONS.basics,
      order: 10,
      requiredIf: true
    }))
    .set('quote', text(['quote'], 'Quote', { section: RACE_SECTIONS.basics, order: 20 }))
    .set('description', text(['description'], 'Description', { section: RACE_SECTIONS.basics, order: 30 }))
    .set('heritageIds', selectMulti(['heritageIds'], 'Heritages', {
      kind: 'DATA',
      relationship: table('heritages', {
        selectColumns: ['id', 'label']
      })
    }, {
      section: RACE_SECTIONS.classification,
      order: 30,
      showIf: isBaseRace,
      hiddenBehavior: 'CLEAR'
    }))
    .set('details', groupArray(['details'], 'Details', () => RACE_DETAIL_NODE_MAP, { section: RACE_SECTIONS.traits, order: 10 }))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, { section: RACE_SECTIONS.features, order: 10 }))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: [
        { code: RACE_CATEGORY_CODE.BASE, label: 'Base Race' },
        { code: RACE_CATEGORY_CODE.SUBRACE, label: 'Subrace' }
      ]
    }, {
      section: RACE_SECTIONS.classification,
      order: 10,
      requiredIf: true
    }))
    .set('selectionMode', selectSingle(['selectionMode'], 'Selection Mode', {
      kind: 'INLINE',
      options: RACE_SELECTION_MODE_OPTIONS
    }, {
      section: RACE_SECTIONS.classification,
      order: 20,
      showIf: isBaseRace,
      requiredIf: true,
      hiddenBehavior: 'CLEAR'
    }))
    .set('ancestry', groupObject(['ancestry'], 'Ancestry', () => RACE_ANCESTRY_NODE_MAP, {
      section: RACE_SECTIONS.ancestry,
      order: 10,
      showIf: isBaseRace,
      hiddenBehavior: 'CLEAR'
    }))
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE',
      options: SIZE_OPTIONS
    }, {
      section: RACE_SECTIONS.traits,
      order: 20,
      showIf: isBaseRace,
      requiredIf: true,
      hiddenBehavior: 'CLEAR'
    }))
    .set('speeds', groupArray(['speeds'], 'Speeds', () => SPEED_NODE_MAP, {
      section: RACE_SECTIONS.traits,
      order: 30,
      showIf: isBaseRace,
      hiddenBehavior: 'CLEAR'
    }))
    .set('parentRaceId', selectSingle(['parentRaceId'], 'Parent Race', {
      kind: 'DATA',
      relationship: table('races', {
        selectColumns: ['id', 'label'],
        where: (col) => col('category').eq('BASE')
      })
    }, {
      section: RACE_SECTIONS.classification,
      order: 40,
      showIf: isSubrace,
      requiredIf: true,
      hiddenBehavior: 'CLEAR'
    }))
})
