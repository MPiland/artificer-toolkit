import type { TargetingAuthored } from '#authored'
import { TARGET_DISPOSITION_KIND_OPTIONS, TARGET_SELECTION_KIND_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import { createBreakpointScalingNodeMap } from '../../shared/maps/scaling.js'

const targeting = buildNodeMap<TargetingAuthored>()

type TargetCountAuthored = {
  amount: number
}

const targetCount = buildNodeMap<TargetCountAuthored>()

const TARGET_COUNT_NODE_MAP = targetCount.define('targetCount', ({ map, nodes }) => {
  const { number } = nodes

  map.set(
    'amount',
    number(['amount'], 'Amount', {
      order: 1,
      requiredIf: true
    })
  )
})

const TARGET_COUNT_SCALING_NODE_MAP = createBreakpointScalingNodeMap(
  'targetCountScaling',
  'Target Count',
  TARGET_COUNT_NODE_MAP
)

export const TARGETING_NODE_MAP: NodeMap<TargetingAuthored> = targeting.define(
  'targeting',
  ({ map, nodes, cond, logic, data }) => {
    const { selectSingle, selectMulti, number, groupObject } = nodes
    const { not } = logic
    const local = cond.local()
    const { table } = data

    map
      .set(
        'selectionKind',
        selectSingle(
          ['selectionKind'],
          'Target Selection',
          {
            kind: 'INLINE_OPTIONS',
            options: TARGET_SELECTION_KIND_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'dispositionKind',
        selectSingle(
          ['dispositionKind'],
          'Target Eligibility',
          {
            kind: 'INLINE_OPTIONS',
            options: TARGET_DISPOSITION_KIND_OPTIONS
          },
          {
            order: 2,
            showIf: not(local.field(['selectionKind']).eq('SELF'))
          }
        )
      )
      .set(
        'excludesSelf',
        nodes.toggle(['excludesSelf'], 'Excludes Self', {
          order: 9,
          showIf: local.field(['selectionKind']).eq('SINGLE_TARGET')
        })
      )
      .set(
        'refusesSelf',
        nodes.toggle(['refusesSelf'], 'Refuses Self', {
          order: 10,
          showIf: local.field(['selectionKind']).eq('SINGLE_TARGET')
        })
      )
      .set(
        'maxTargets',
        number(['maxTargets'], 'Max Targets', {
          order: 3,
          showIf: local.field(['selectionKind']).eq('CHOSEN_CREATURES')
        })
      )
      .set(
        'maxTargetsScaling',
        groupObject(
          ['maxTargetsScaling'],
          'Max Targets Scaling',
          () => TARGET_COUNT_SCALING_NODE_MAP,
          {
            presentation: 'inline',
            order: 4,
            showIf: local.field(['selectionKind']).eq('CHOSEN_CREATURES')
          }
        )
      )
      .set(
        'excludedCreatureTypeIds',
        selectMulti(
          ['excludedCreatureTypeIds'],
          'Excluded Creature Types',
          {
            kind: 'DATA',
            relationship: table('creature_types', {
              selectColumns: ['id', 'label']
            })
          },
          {
            order: 8,
            showIf: not(local.field(['selectionKind']).eq('SELF'))
          }
        )
      )
      .set(
        'resolutionCount',
        number(['resolutionCount'], 'Resolution Count', {
          order: 5,
          showIf: local.field(['selectionKind']).eq('CHOSEN_CREATURES')
        })
      )
      .set(
        'resolutionCountScaling',
        groupObject(
          ['resolutionCountScaling'],
          'Resolution Count Scaling',
          () => TARGET_COUNT_SCALING_NODE_MAP,
          {
            presentation: 'inline',
            order: 6,
            showIf: local.field(['selectionKind']).eq('CHOSEN_CREATURES')
          }
        )
      )
      .set(
        'allowRepeatedTargets',
        nodes.toggle(['allowRepeatedTargets'], 'Allow Repeated Targets', {
          order: 7,
          showIf: local.field(['selectionKind']).eq('CHOSEN_CREATURES')
        })
      )
  }
)
