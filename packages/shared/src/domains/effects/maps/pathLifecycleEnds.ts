import type { PathLifecycleAuthored } from '#authored'
import { buildNodeMap, type NodeMap } from '#utils'
import { MODIFIER_GRANT_NODE_MAP } from '../../grants/maps/modifier.js'
import { CHECK_CHOICE_NODE_MAP, HELD_ESCAPE_DC_NODE_MAP } from './check.js'
import { ACTIVATION_NODE_MAP } from './invocation.js'

const pathLifecycleEscape = buildNodeMap<NonNullable<PathLifecycleAuthored['escape']>>()
const pathLifecycleOnEnd = buildNodeMap<NonNullable<PathLifecycleAuthored['onEnd']>>()
const pathLifecycleTurnEndGate = buildNodeMap<NonNullable<PathLifecycleAuthored['turnEndGate']>>()

export const PATH_LIFECYCLE_ESCAPE_NODE_MAP: NodeMap<NonNullable<PathLifecycleAuthored['escape']>> =
  pathLifecycleEscape.define('pathLifecycleEscape', ({ map, nodes }) => {
    const { groupObject } = nodes

    map
      .set(
        'activation',
        groupObject(['activation'], 'Costs', () => ACTIVATION_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set(
        'checks',
        groupObject(['checks'], 'Escape Checks', () => CHECK_CHOICE_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set(
        'dc',
        groupObject(['dc'], 'Escape DC', () => HELD_ESCAPE_DC_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  })

export const PATH_LIFECYCLE_ON_END_NODE_MAP: NodeMap<NonNullable<PathLifecycleAuthored['onEnd']>> =
  pathLifecycleOnEnd.define('pathLifecycleOnEnd', ({ map, nodes }) => {
    const { number, groupArray } = nodes

    map
      .set(
        'turns',
        number(['turns'], 'Holder Turns', {
          requiredIf: true,
          constraints: { minimum: 1, maximum: 255 }
        })
      )
      .set(
        'modifiers',
        groupArray(['modifiers'], 'Modifier Grants', () => MODIFIER_GRANT_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  })

export const PATH_LIFECYCLE_TURN_END_GATE_NODE_MAP: NodeMap<
  NonNullable<PathLifecycleAuthored['turnEndGate']>
> = pathLifecycleTurnEndGate.define('pathLifecycleTurnEndGate', ({ map, nodes }) => {
  const { number } = nodes

  map.set(
    'minimumRoll',
    number(['minimumRoll'], 'Minimum d20 Roll', {
      requiredIf: true,
      constraints: { minimum: 2, maximum: 20 }
    })
  )
})
