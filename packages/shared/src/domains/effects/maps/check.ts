import type {
  CheckAuthored,
  CheckChoiceAuthored,
  CheckDcAuthored,
  HeldEscapeDcAuthored
} from '#authored'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

type CheckDcNode = AllUnionFields<CheckDcAuthored>

const checkChoice = buildNodeMap<CheckChoiceAuthored>()
const checkDc = buildNodeMap<CheckDcNode>()
const heldEscapeDc = buildNodeMap<AllUnionFields<HeldEscapeDcAuthored>>()
const check = buildNodeMap<CheckAuthored>()

export const CHECK_CHOICE_NODE_MAP = checkChoice.define('checkChoice', ({ map, nodes, data }) => {
  const { selectMulti } = nodes
  const { table } = data
  map
    .set(
      'skillIds',
      selectMulti(['skillIds'], 'Skill Checks', {
        kind: 'DATA',
        relationship: table('skills', { selectColumns: ['id', 'label', 'description'] })
      })
    )
    .set(
      'abilityDefinitionIds',
      selectMulti(['abilityDefinitionIds'], 'Ability Checks', {
        kind: 'DATA',
        relationship: table('ability_definitions', {
          selectColumns: ['id', 'label', 'description']
        })
      })
    )
})

const CHECK_DC_KIND_OPTIONS = [
  { code: 'FIXED', label: 'Fixed DC' },
  { code: 'CONTEST', label: 'Contest' },
  { code: 'PASSIVE', label: 'Observer Passive Score' },
  { code: 'CONCEALMENT', label: 'Concealment Check Total' }
] as const

/** A check DC map offering only `kinds`, so a context offers just the DCs its rules honour. */
function defineCheckDcNodeMap(mapId: string, kinds: readonly CheckDcAuthored['kind'][]) {
  return checkDc.define(mapId, ({ map, nodes, data, cond }) => {
    const { number, selectSingle, groupObject } = nodes
    const { table } = data
    const local = cond.local()
    map
      .set(
        'kind',
        selectSingle(['kind'], 'DC', {
          kind: 'INLINE_OPTIONS',
          options: CHECK_DC_KIND_OPTIONS.filter(({ code }) => kinds.includes(code))
        })
      )
      .set(
        'value',
        number(['value'], 'Fixed DC', {
          constraints: { minimum: 1 },
          showIf: local.field(['kind']).eq('FIXED')
        })
      )
      .set(
        'checks',
        groupObject(['checks'], 'Source Checks', () => CHECK_CHOICE_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['kind']).eq('CONTEST')
        })
      )
    if (kinds.includes('PASSIVE'))
      map.set(
        'passiveDefinitionId',
        selectSingle(
          ['passiveDefinitionId'],
          'Passive Score',
          {
            kind: 'DATA',
            relationship: table('passives', { selectColumns: ['id', 'label', 'description'] })
          },
          { showIf: local.field(['kind']).eq('PASSIVE') }
        )
      )
  })
}

/** Every DC kind: a check an actor makes on itself (Hide, Search, First Aid). */
export const CHECK_DC_NODE_MAP = defineCheckDcNodeMap('checkDc', [
  'FIXED',
  'CONTEST',
  'PASSIVE',
  'CONCEALMENT'
])

/** An escape check is held against a fixed DC or a contest only. */
export const ESCAPE_DC_NODE_MAP = defineCheckDcNodeMap('escapeDc', ['FIXED', 'CONTEST'])

/** An escape from a zone-held condition is held against a fixed DC or its source's save DC. */
export const HELD_ESCAPE_DC_NODE_MAP = heldEscapeDc.define(
  'heldEscapeDc',
  ({ map, nodes, cond }) => {
    const { number, selectSingle } = nodes
    const local = cond.local()
    map
      .set(
        'kind',
        selectSingle(['kind'], 'DC', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'FIXED', label: 'Fixed DC' },
            { code: 'SOURCE_SAVE_DC', label: 'Source Save DC' }
          ]
        })
      )
      .set(
        'value',
        number(['value'], 'Fixed DC', {
          constraints: { minimum: 1 },
          showIf: local.field(['kind']).eq('FIXED')
        })
      )
  }
)

export const CHECK_NODE_MAP = check.define('check', ({ map, nodes }) => {
  const { groupObject } = nodes
  map
    .set(
      'checks',
      groupObject(['checks'], 'Checks', () => CHECK_CHOICE_NODE_MAP, { presentation: 'inline' })
    )
    .set(
      'dc',
      groupObject(['dc'], 'DC', () => CHECK_DC_NODE_MAP, { presentation: 'inline' })
    )
})
