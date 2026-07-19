import type { ScalableValueAuthored, ScalingBreakpoint } from '#core'
import { SCALING_SOURCE_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'

export function createBreakpointScalingNodeMap(
  mapId: string,
  valueLabel: string,
  valueNodeMap: NodeMap<Record<string, unknown>>
): NodeMap<ScalableValueAuthored<Record<string, unknown>>> {
  const breakpoint = buildNodeMap<ScalingBreakpoint<Record<string, unknown>>>()

  const breakpointNodeMap = breakpoint.define(`${mapId}Breakpoint`, ({ map, nodes }) => {
    const { text, number, groupObject } = nodes
    const valueField = groupObject(['value'], valueLabel, () => valueNodeMap, { presentation: 'inline',
      order: 4,
      requiredIf: true
    })

    map
      .set('id', text(['id'], 'ID', {
        order: 1,
        requiredIf: true
      }))
      .set('level', number(['level'], 'Level', {
        order: 2,
        requiredIf: true
      }))
      .set('order', number(['order'], 'Order', {
        order: 3,
        requiredIf: true
      }))
      .set('value', valueField)
  })

  const scaling = buildNodeMap<ScalableValueAuthored<Record<string, unknown>>>()

  return scaling.define(mapId, ({ map, nodes, cond, data }) => {
    const { selectSingle, groupArray } = nodes
    const local = cond.local()
    const { table } = data

    map
      .set('scalingKind', selectSingle(['scalingKind'], 'Scaling Kind', {
        kind: 'INLINE_OPTIONS',
        options: [{ code: 'BREAKPOINTS', label: 'Breakpoints' }]
      }, {
        order: 1,
        requiredIf: true
      }))
      .set('scalingSource', selectSingle(['scalingSource'], 'Scaling Source', {
        kind: 'INLINE_OPTIONS',
        options: SCALING_SOURCE_OPTIONS
      }, {
        order: 2,
        requiredIf: true
      }))
      .set('classId', selectSingle(['classId'], 'Class', {
        kind: 'DATA',
        relationship: table('classes', {
          selectColumns: ['id', 'label']
        })
      }, {
        order: 3,
        requiredIf: true,
        showIf: local.field(['scalingSource']).eq('CLASS_LEVEL')
      }))
      .set('breakpoints', groupArray(['breakpoints'], 'Breakpoints', () => breakpointNodeMap, { presentation: 'table',
        order: 4,
        requiredIf: true
      }))
  })
}
