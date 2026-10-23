import {
  ACTIVATION_OPTIONS,
  PATH_LIFECYCLE_STEP_DOWN_TRIGGER_OPTIONS,
  PATH_LIFECYCLE_TURN_ACTOR_OPTIONS,
  PATH_LIFECYCLE_TURN_BOUNDARY_OPTIONS
} from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import type { PathLifecycleAuthored } from '#authored'

const pathLifecycleTurnAnchor = buildNodeMap<NonNullable<PathLifecycleAuthored['turnAnchor']>>()
const pathLifecycleHolderEnd = buildNodeMap<NonNullable<PathLifecycleAuthored['holderEnd']>>()
const pathLifecycleStepDown = buildNodeMap<NonNullable<PathLifecycleAuthored['stepDown']>>()

export const PATH_LIFECYCLE_TURN_ANCHOR_NODE_MAP: NodeMap<
  NonNullable<PathLifecycleAuthored['turnAnchor']>
> = pathLifecycleTurnAnchor.define('pathLifecycleTurnAnchor', ({ map, nodes }) => {
  const { selectSingle } = nodes

  map
    .set(
      'actor',
      selectSingle(
        ['actor'],
        'Counted On',
        { kind: 'INLINE_OPTIONS', options: PATH_LIFECYCLE_TURN_ACTOR_OPTIONS },
        { requiredIf: true }
      )
    )
    .set(
      'boundary',
      selectSingle(
        ['boundary'],
        'Counted At',
        { kind: 'INLINE_OPTIONS', options: PATH_LIFECYCLE_TURN_BOUNDARY_OPTIONS },
        { requiredIf: true }
      )
    )
})

export const PATH_LIFECYCLE_HOLDER_END_NODE_MAP: NodeMap<
  NonNullable<PathLifecycleAuthored['holderEnd']>
> = pathLifecycleHolderEnd.define('pathLifecycleHolderEnd', ({ map, nodes }) => {
  const { selectSingle } = nodes

  map.set(
    'activation',
    selectSingle(
      ['activation'],
      'Costs',
      { kind: 'INLINE_OPTIONS', options: ACTIVATION_OPTIONS },
      { requiredIf: true }
    )
  )
})

export const PATH_LIFECYCLE_STEP_DOWN_NODE_MAP: NodeMap<
  NonNullable<PathLifecycleAuthored['stepDown']>
> = pathLifecycleStepDown.define('pathLifecycleStepDown', ({ map, nodes }) => {
  const { selectSingle, number } = nodes

  map
    .set(
      'trigger',
      selectSingle(
        ['trigger'],
        'Steps Down At',
        { kind: 'INLINE_OPTIONS', options: PATH_LIFECYCLE_STEP_DOWN_TRIGGER_OPTIONS },
        { requiredIf: true }
      )
    )
    .set(
      'step',
      number(['step'], 'Steps Down By', {
        constraints: { minimum: 1, maximum: 255 },
        requiredIf: true
      })
    )
})
