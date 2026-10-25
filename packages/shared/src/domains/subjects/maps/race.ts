import { RACE_CATEGORY_CODE, RACE_SELECTION_MODE_OPTIONS } from '#core'
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
  ancestry: { id: 'ancestry', label: 'Ancestry', order: 20 },
  traits: { id: 'traits', label: 'Traits', order: 30 },
  features: { id: 'features', label: 'Features', order: 40 }
} as const

const RACE_ANCESTRY_SECTIONS = {
  details: { id: 'ancestryDetails', label: 'Details', order: 10 },
  options: { id: 'ancestryOptions', label: 'Options', order: 20 }
} as const

const RACE_ANCESTRY_OPTION_SECTIONS = {
  basics: { id: 'ancestryOptionBasics', label: 'Basics', order: 10 },
  features: { id: 'ancestryOptionFeatures', label: 'Features', order: 20 }
} as const

const detailNode = buildNodeMap<DetailAuthored>()

export const RACE_DETAIL_NODE_MAP = detailNode.define('raceDetail', ({ map, nodes }) => {
  const { text, richText, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', richText(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const ancestryOptionNode = buildNodeMap<RaceAncestryOptionAuthored>()

const RACE_ANCESTRY_OPTION_NODE_MAP = ancestryOptionNode.define(
  'raceAncestryOption',
  ({ map, nodes }) => {
    const { text, richText, number, groupArray } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'label',
        text(['label'], 'Name', { section: RACE_ANCESTRY_OPTION_SECTIONS.basics, order: 10 })
      )
      .set(
        'description',
        richText(['description'], 'Description', {
          section: RACE_ANCESTRY_OPTION_SECTIONS.basics,
          order: 20
        })
      )
      .set(
        'order',
        number(['order'], 'Order', { section: RACE_ANCESTRY_OPTION_SECTIONS.basics, order: 30 })
      )
      .set(
        'features',
        groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, {
          presentation: 'branch',
          section: RACE_ANCESTRY_OPTION_SECTIONS.features,
          order: 10
        })
      )
  }
)

const ancestryNode = buildNodeMap<RaceAncestryAuthored>()

const RACE_ANCESTRY_NODE_MAP = ancestryNode.define('raceAncestry', ({ map, nodes }) => {
  const { text, richText, groupArray } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Name', { section: RACE_ANCESTRY_SECTIONS.details, order: 10 }))
    .set(
      'description',
      richText(['description'], 'Description', {
        section: RACE_ANCESTRY_SECTIONS.details,
        order: 20
      })
    )
    .set(
      'options',
      groupArray(['options'], 'Options', () => RACE_ANCESTRY_OPTION_NODE_MAP, {
        presentation: 'branch',
        section: RACE_ANCESTRY_SECTIONS.options,
        order: 10
      })
    )
})

const raceNode = buildNodeMap<RaceAuthored>()

export const RACE_NODE_MAP = raceNode.define('race', ({ map, nodes, cond, data }) => {
  const { text, richText, selectSingle, selectMulti, groupArray, groupObject } = nodes
  const local = cond.local()
  const { table } = data

  const isBaseRace = local.field(['category']).eq(RACE_CATEGORY_CODE.BASE)
  const isSubrace = local.field(['category']).eq(RACE_CATEGORY_CODE.SUBRACE)

  map
    .set('id', text(['id'], 'ID'))
    .set(
      'label',
      text(['label'], 'Name', {
        section: RACE_SECTIONS.basics,
        order: 10,
        requiredIf: true
      })
    )
    .set('quote', richText(['quote'], 'Quote', { section: RACE_SECTIONS.basics, order: 20 }))
    .set(
      'description',
      richText(['description'], 'Description', { section: RACE_SECTIONS.basics, order: 30 })
    )
    .set(
      'heritageIds',
      selectMulti(
        ['heritageIds'],
        'Heritages',
        {
          kind: 'DATA',
          relationship: table('heritages', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        {
          section: RACE_SECTIONS.basics,
          order: 60,
          showIf: isBaseRace,
          hiddenBehavior: 'CLEAR'
        }
      )
    )
    .set(
      'details',
      groupArray(['details'], 'Details', () => RACE_DETAIL_NODE_MAP, {
        presentation: 'inline',
        section: RACE_SECTIONS.traits,
        order: 10
      })
    )
    .set(
      'features',
      groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, {
        presentation: 'branch',
        section: RACE_SECTIONS.features,
        order: 10
      })
    )
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set(
      'category',
      selectSingle(
        ['category'],
        'Category',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: RACE_CATEGORY_CODE.BASE, label: 'Base Race' },
            { code: RACE_CATEGORY_CODE.SUBRACE, label: 'Subrace' }
          ]
        },
        {
          section: RACE_SECTIONS.basics,
          order: 40,
          requiredIf: true
        }
      )
    )
    .set(
      'selectionMode',
      selectSingle(
        ['selectionMode'],
        'Selection Mode',
        {
          kind: 'INLINE_OPTIONS',
          options: RACE_SELECTION_MODE_OPTIONS
        },
        {
          section: RACE_SECTIONS.basics,
          order: 50,
          showIf: isBaseRace,
          requiredIf: true,
          hiddenBehavior: 'CLEAR'
        }
      )
    )
    .set(
      'ancestry',
      groupObject(['ancestry'], 'Ancestry', () => RACE_ANCESTRY_NODE_MAP, {
        presentation: 'branch',
        section: RACE_SECTIONS.ancestry,
        order: 10,
        showIf: isBaseRace,
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'size',
      selectSingle(
        ['size'],
        'Size',
        {
          kind: 'DATA',
          relationship: table('sizes', { selectColumns: ['id', 'label', 'description'] })
        },
        {
          section: RACE_SECTIONS.traits,
          order: 20,
          showIf: isBaseRace,
          requiredIf: true,
          hiddenBehavior: 'CLEAR'
        }
      )
    )
    .set(
      'speeds',
      groupArray(['speeds'], 'Speeds', () => SPEED_NODE_MAP, {
        presentation: 'inline',
        section: RACE_SECTIONS.traits,
        order: 30,
        showIf: isBaseRace,
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'parentRaceId',
      selectSingle(
        ['parentRaceId'],
        'Parent Race',
        {
          kind: 'DATA',
          relationship: table('races', {
            selectColumns: ['id', 'label'],
            where: (col) => col('category').eq('BASE')
          })
        },
        {
          section: RACE_SECTIONS.basics,
          order: 70,
          showIf: isSubrace,
          requiredIf: true,
          hiddenBehavior: 'CLEAR'
        }
      )
    )
})
