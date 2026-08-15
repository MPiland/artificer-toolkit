import type {
  ActivationAuthored,
  EffectInvocationKind,
  EffectInvocationAuthored,
  ResourceUseAuthored
} from '#authored'
import { ACTIVATION_OPTIONS, TRIGGER_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import { RANGE_NODE_MAP, SAVING_THROW_NODE_MAP, SHAPE_NODE_MAP } from '../../shared/maps/index.js'
import { TARGETING_NODE_MAP } from './targeting.js'

const INVOCATION_KIND_OPTIONS: { code: EffectInvocationKind; label: string }[] = [
  { code: 'ACTION', label: 'Action' },
  { code: 'PASSIVE', label: 'Passive' }
]

const activation = buildNodeMap<ActivationAuthored>()
const resourceUse = buildNodeMap<ResourceUseAuthored>()

export const ACTIVATION_NODE_MAP = activation.define(
  'activation',
  ({ map, nodes, cond, logic }) => {
    const { selectSingle, number } = nodes
    const { not } = logic
    const local = cond.local()

    map
      .set(
        'code',
        selectSingle(
          ['code'],
          'Activation',
          {
            kind: 'INLINE_OPTIONS',
            options: ACTIVATION_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          order: 2,
          requiredIf: true,
          showIf: not(local.field(['code']).eq('FREE'))
        })
      )
  }
)

const RESOURCE_USE_NODE_MAP = resourceUse.define('resourceUse', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('chargeId', text(['chargeId'], 'Charge ID', { requiredIf: true }))
    .set('cost', number(['cost'], 'Cost', { constraints: { minimum: 1 }, requiredIf: true }))
})

const invocation = buildNodeMap<EffectInvocationAuthored>()

export type InvocationNodeMap = NodeMap<EffectInvocationAuthored>

export const INVOCATION_NODE_MAP: InvocationNodeMap = invocation.define(
  'invocation',
  ({ map, nodes, cond, logic }) => {
    const { selectSingle, groupObject } = nodes
    const { and } = logic
    const local = cond.local()

    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: INVOCATION_KIND_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'triggerCode',
        selectSingle(
          ['triggerCode'],
          'Trigger',
          {
            kind: 'INLINE_OPTIONS',
            options: TRIGGER_OPTIONS
          },
          {
            order: 2,
            requiredIf: true
          }
        )
      )
      .set(
        'savingThrow',
        groupObject(['savingThrow'], 'Saving Throw', () => SAVING_THROW_NODE_MAP, {
          presentation: 'inline',
          order: 3,
          showIf: and([local.field(['triggerCode']).eq('SAVING_THROW')])
        })
      )
      .set(
        'activation',
        groupObject(['activation'], 'Activation', () => ACTIVATION_NODE_MAP, {
          presentation: 'inline',
          order: 4,
          requiredIf: true,
          showIf: local.field(['kind']).eq('ACTION')
        })
      )
      .set(
        'resourceUse',
        groupObject(['resourceUse'], 'Resource Use', () => RESOURCE_USE_NODE_MAP, {
          presentation: 'inline',
          order: 5,
          showIf: local.field(['kind']).eq('ACTION')
        })
      )
      .set(
        'range',
        groupObject(['range'], 'Range', () => RANGE_NODE_MAP, {
          presentation: 'inline',
          order: 6,
          requiredIf: true
        })
      )
      .set(
        'shape',
        groupObject(['shape'], 'Shape', () => SHAPE_NODE_MAP, { presentation: 'inline', order: 7 })
      )
      .set(
        'targeting',
        groupObject(['targeting'], 'Targeting', () => TARGETING_NODE_MAP, {
          presentation: 'inline',
          order: 8
        })
      )
  }
)
