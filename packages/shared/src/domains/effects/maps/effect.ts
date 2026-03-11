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
  = activation.define((map, { not, local }) => map({
    code: {
      kind: 'INPUT',
      label: 'Activation',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: ACTIVATION_OPTIONS
      }
    },
    amount: {
      kind: 'INPUT',
      label: 'Amount',
      requiredIf: true,
      type: 'NUMBER',
      showIf: not(local('code').eq('FREE'))
    }
  }))

const invoction = buildNodeMap<InvocationAuthored>()

type InvocationNodeMap = NodeMap<InvocationAuthored>

export const INVOCATION_NODE_MAP: InvocationNodeMap
  = invoction.define((map, { local }) => map({
    triggerCode: {
      kind: 'INPUT',
      label: 'Trigger',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: TRIGGER_OPTIONS
      }
    },
    savingThrow: {
      kind: 'GROUP',
      nodes: SAVING_THROW_NODE_MAP,
      showIf: local('triggerCode').eq('SAVING_THROW')
    },
    activation: {
      kind: 'GROUP',
      nodes: ACTIVATION_NODE_MAP
    },
    range: {
      kind: 'GROUP',
      nodes: RANGE_NODE_MAP
    },
    shape: {
      kind: 'GROUP',
      nodes: SHAPE_NODE_MAP
    }
  }))

export const effect = buildNodeMap<EffectAuthored>()

type EffectNodeMap = NodeMap<EffectAuthored>

export const EFFECT_NODE_MAP: EffectNodeMap = effect.define((map) => map({
  invocation: {
    kind: 'GROUP',
    nodes: INVOCATION_NODE_MAP
  },
  moments: {
    kind: 'GROUP',
    nodes: MOMENT_NODE_MAP
  }
}))
