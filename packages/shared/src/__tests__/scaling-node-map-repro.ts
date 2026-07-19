import type { ScalableValueAuthored, ScalingBreakpoint } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'

type PayloadValue = {
  amount: number
}

const payload = buildNodeMap<PayloadValue>()

const PAYLOAD_NODE_MAP = payload.define('payloadValue', ({ map, nodes }) => {
  map.set('amount', nodes.number(['amount'], 'Amount'))
})

function reproduceScalingNodeMapGenericBreak<TValue extends Record<string, unknown>>(
  valueNodeMap: NodeMap<TValue>
): void {
  const breakpoint = buildNodeMap<ScalingBreakpoint<TValue>>()

  const BREAKPOINT_NODE_MAP = breakpoint.define('breakpointRepro', ({ map, nodes }) => {
    // This is the first place the generic wrapper breaks down.
    // TypeScript does not materialize ['value'] as a valid group key here.
    map.set(
      'value',
      // @ts-expect-error generic nested object key is rejected by the current node builder types
      nodes.groupObject(['value'], 'Value', () => valueNodeMap, { presentation: 'inline' })
    )
  })

  const scaling = buildNodeMap<ScalableValueAuthored<TValue>>()

  scaling.define('scalingRepro', ({ map, nodes }) => {
    // This compiles in isolation; the broader helper failure comes from the nested value group above.
    map.set(
      'breakpoints',
      nodes.groupArray(['breakpoints'], 'Breakpoints', () => BREAKPOINT_NODE_MAP, {
        presentation: 'inline'
      })
    )
  })
}

function reproduceScalingNodeMapMaterializedAlias<TValue extends Record<string, unknown>>(
  valueNodeMap: NodeMap<TValue>
): void {
  type TMaterialized = { [K in keyof TValue]: TValue[K] }

  const breakpoint = buildNodeMap<ScalingBreakpoint<TMaterialized>>()

  const BREAKPOINT_NODE_MAP = breakpoint.define('breakpointMaterializedRepro', ({ map, nodes }) => {
    // Even with a materialized alias, the nested group-key conditional still rejects the generic payload.
    // That means the helper needs either a broader implementation signature or a deeper node-definition change.
    map.set(
      'value',
      // @ts-expect-error materializing the payload alias still does not resolve the group key
      nodes.groupObject(['value'], 'Value', () => valueNodeMap, { presentation: 'inline' })
    )
  })

  const scaling = buildNodeMap<ScalableValueAuthored<TMaterialized>>()

  scaling.define('scalingMaterializedRepro', ({ map, nodes }) => {
    map.set(
      'breakpoints',
      nodes.groupArray(['breakpoints'], 'Breakpoints', () => BREAKPOINT_NODE_MAP, {
        presentation: 'inline'
      })
    )
  })
}

reproduceScalingNodeMapGenericBreak(PAYLOAD_NODE_MAP)
reproduceScalingNodeMapMaterializedAlias(PAYLOAD_NODE_MAP)
