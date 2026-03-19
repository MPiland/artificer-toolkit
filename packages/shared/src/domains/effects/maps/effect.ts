import type {
  InvocationAuthored,
  ActivationAuthored,
  EffectAuthored,
  TargetingAuthored
} from '#authored'
import {
  ACTIVATION_OPTIONS,
  TARGET_DISPOSITION_KIND_OPTIONS,
  TARGET_SELECTION_KIND_OPTIONS,
  TRIGGER_OPTIONS
} from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import {
  RANGE_NODE_MAP,
  SHAPE_NODE_MAP,
  BRANCH_NODE_MAP,
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

const targeting = buildNodeMap<TargetingAuthored>()

export const TARGETING_NODE_MAP
  = targeting.define('targeting', ({ map, nodes, cond, logic }) => {
    const { selectSingle, number, text } = nodes
    const { not } = logic
    const local = cond.local()

    map
      .set('selectionKind', selectSingle(['selectionKind'], 'Target Selection', {
        kind: 'INLINE',
        options: TARGET_SELECTION_KIND_OPTIONS
      }, {
        order: 1,
        requiredIf: true
      }))
      .set('dispositionKind', selectSingle(['dispositionKind'], 'Disposition', {
        kind: 'INLINE',
        options: TARGET_DISPOSITION_KIND_OPTIONS
      }, {
        order: 2,
        showIf: not(local.field(['selectionKind']).eq('SELF'))
      }))
      .set('maxTargets', number(['maxTargets'], 'Max Targets', {
        order: 3,
        showIf: not(local.field(['selectionKind']).eq('SELF'))
      }))
      .set('detail', text(['detail'], 'Detail', {
        order: 4
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
      .set('targeting', groupObject(['targeting'], 'Targeting', () => TARGETING_NODE_MAP, {
        order: 6
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
    .set('branches', groupArray(['branches'], 'Branches', () => BRANCH_NODE_MAP))
})
