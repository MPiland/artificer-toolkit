import type { CheckAuthored, CheckChoiceAuthored, CheckDcAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

type CheckDcNode = AllUnionFields<CheckDcAuthored>

const checkChoice = buildNodeMap<CheckChoiceAuthored>()
const checkDc = buildNodeMap<CheckDcNode>()
const check = buildNodeMap<CheckAuthored>()

export const CHECK_CHOICE_NODE_MAP = checkChoice.define('checkChoice', ({ map, nodes, data }) => {
  const { selectMulti } = nodes
  const { table } = data
  map
    .set(
      'skillIds',
      selectMulti(['skillIds'], 'Skill Checks', {
        kind: 'DATA',
        relationship: table('skills', { selectColumns: ['id', 'label'] })
      })
    )
    .set(
      'abilityDefinitionIds',
      selectMulti(['abilityDefinitionIds'], 'Ability Checks', {
        kind: 'DATA',
        relationship: table('ability_definitions', { selectColumns: ['id', 'label'] })
      })
    )
})

export const CHECK_DC_NODE_MAP = checkDc.define('checkDc', ({ map, nodes, cond }) => {
  const { number, selectSingle, groupObject } = nodes
  const local = cond.local()
  map
    .set(
      'kind',
      selectSingle(['kind'], 'DC', {
        kind: 'INLINE_OPTIONS',
        options: [
          { code: 'FIXED', label: 'Fixed DC' },
          { code: 'CONTEST', label: 'Contest' }
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
    .set(
      'checks',
      groupObject(['checks'], 'Source Checks', () => CHECK_CHOICE_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['kind']).eq('CONTEST')
      })
    )
})

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
