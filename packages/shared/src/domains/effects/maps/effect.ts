import type {
  InvocationAuthored,
  ActivationAuthored,
  EffectAuthored
} from '#authored'
import {
  ACTIVATION_OPTIONS,
  TRIGGER_OPTIONS
} from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import {
  RANGE_NODE_MAP,
  SHAPE_NODE_MAP,
  MOMENT_NODE_MAP,
  SAVING_THROW_NODE_MAP
} from '#maps'

const activation = buildNodeMap<ActivationAuthored>()

export const ACTIVATION_NODE_MAP
  = activation.define('activation', ({ map, nodes, cond, logic }) => {
    const { selectSingle, number } = nodes
    const { not } = logic
    const local = cond.local()

    map
      .set('code', selectSingle(['code'], 'Activation', {
        kind: 'INLINE',
        options: ACTIVATION_OPTIONS
      }, {
        order: 1,
        requiredIf: true
      }))
      .set('amount', number(['amount'], 'Amount', {
        order: 2,
        requiredIf: true,
        showIf: not(local.field(['code']).eq('FREE'))
      }))
  })

const invoction = buildNodeMap<InvocationAuthored>()

type InvocationNodeMap = NodeMap<InvocationAuthored>

export const INVOCATION_NODE_MAP: InvocationNodeMap
  = invoction.define('invocation', ({ map, nodes, cond }) => {
    const { selectSingle, groupObject } = nodes
    const local = cond.local()

    map
      .set('triggerCode', selectSingle(['triggerCode'], 'Trigger', {
        kind: 'INLINE',
        options: TRIGGER_OPTIONS
      }, {
        order: 1,
        requiredIf: true
      }))
      .set('savingThrow', groupObject(['savingThrow'], 'Saving Throw', () => SAVING_THROW_NODE_MAP, {
        order: 2,
        showIf: local.field(['triggerCode']).eq('SAVING_THROW')
      }))
      .set('activation', groupObject(['activation'], 'Activation', () => ACTIVATION_NODE_MAP, {
        order: 3,
        requiredIf: true
      }))
      .set('range', groupObject(['range'], 'Range', () => RANGE_NODE_MAP, {
        order: 4,
        requiredIf: true
      }))
      .set('shape', groupObject(['shape'], 'Shape', () => SHAPE_NODE_MAP, {
        order: 5
      }))
  })

export const effect = buildNodeMap<EffectAuthored>()

type EffectNodeMap = NodeMap<EffectAuthored>

export const EFFECT_NODE_MAP: EffectNodeMap = effect.define('effect', ({ map, nodes }) => {
  const { text, number, groupObject, groupArray } = nodes
  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order'))
    .set('invocation', groupObject(['invocation'], 'Invocation', () => INVOCATION_NODE_MAP))
    .set('moments', groupArray(['moments'], 'Moments', () => MOMENT_NODE_MAP))
})
