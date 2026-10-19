import type { TargetingAuthored } from '#authored'
import {
  TARGET_DISPOSITION_KIND_OPTIONS,
  TARGET_SELECTION_KIND_OPTIONS,
  TARGET_SELF_POLICY_OPTIONS
} from '#core'
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

type HitPointPoolAuthored = {
  diceConfig: string
}

const hitPointPool = buildNodeMap<HitPointPoolAuthored>()

const HIT_POINT_POOL_NODE_MAP = hitPointPool.define('hitPointPool', ({ map, nodes }) => {
  const { text } = nodes

  map.set(
    'diceConfig',
    text(['diceConfig'], 'Pool Dice', {
      order: 1,
      requiredIf: true
    })
  )
})

const HIT_POINT_POOL_SCALING_NODE_MAP = createBreakpointScalingNodeMap(
  'hitPointPoolScaling',
  'Hit Point Pool',
  HIT_POINT_POOL_NODE_MAP
)

type SizeLimitAuthored = {
  stepsAboveActor: number
}

const sizeLimit = buildNodeMap<SizeLimitAuthored>()

const SIZE_LIMIT_NODE_MAP = sizeLimit.define('sizeLimit', ({ map, nodes }) => {
  const { number } = nodes

  map.set(
    'stepsAboveActor',
    number(['stepsAboveActor'], 'Size Steps Above the User', {
      order: 1,
      requiredIf: true
    })
  )
})

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
        'self',
        selectSingle(
          ['self'],
          'Naming the User',
          {
            kind: 'INLINE_OPTIONS',
            options: TARGET_SELF_POLICY_OPTIONS
          },
          {
            order: 10,
            showIf: local.field(['selectionKind']).eq('SINGLE_TARGET')
          }
        )
      )
      .set(
        'sizeLimit',
        groupObject(['sizeLimit'], 'Size Limit', () => SIZE_LIMIT_NODE_MAP, {
          presentation: 'inline',
          order: 11,
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
        'hitPointPool',
        groupObject(['hitPointPool'], 'Hit Point Pool', () => HIT_POINT_POOL_NODE_MAP, {
          presentation: 'inline',
          order: 5,
          showIf: local.field(['selectionKind']).eq('AREA_CONTENTS')
        })
      )
      .set(
        'hitPointPoolScaling',
        groupObject(
          ['hitPointPoolScaling'],
          'Hit Point Pool Scaling',
          () => HIT_POINT_POOL_SCALING_NODE_MAP,
          {
            presentation: 'inline',
            order: 6,
            showIf: local.field(['selectionKind']).eq('AREA_CONTENTS')
          }
        )
      )
      .set(
        'hitPointPoolIgnoredConditionIds',
        selectMulti(
          ['hitPointPoolIgnoredConditionIds'],
          'Conditions the Pool Ignores',
          {
            kind: 'DATA',
            relationship: table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 12,
            showIf: local.field(['selectionKind']).eq('AREA_CONTENTS')
          }
        )
      )
      .set(
        'allowedCreatureTypeIds',
        selectMulti(
          ['allowedCreatureTypeIds'],
          'Allowed Creature Types',
          {
            kind: 'DATA',
            relationship: table('creature_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 8,
            showIf: not(local.field(['selectionKind']).eq('SELF'))
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
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 9,
            showIf: not(local.field(['selectionKind']).eq('SELF'))
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
