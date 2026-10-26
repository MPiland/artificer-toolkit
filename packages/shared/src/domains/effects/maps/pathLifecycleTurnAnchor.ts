import type { PathLifecycleAuthored } from '#authored'
import { PATH_LIFECYCLE_TURN_ACTOR_OPTIONS, PATH_LIFECYCLE_TURN_BOUNDARY_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'

const pathLifecycleTurnAnchor = buildNodeMap<NonNullable<PathLifecycleAuthored['turnAnchor']>>()

/** The turn a lifecycle or a hold's recurrence counts on: whose turn, and at which boundary. */
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
