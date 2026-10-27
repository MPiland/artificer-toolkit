import type { ForcedMovementAuthored } from '#authored'
import {
  EFFECT_KIND,
  FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS,
  FORCED_MOVEMENT_DIRECTION_OPTIONS,
  FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS,
  LENGTH_UNIT_OPTIONS
} from '#core'
import { buildNodeMap, type BuildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'
import { FORCED_MOVEMENT_COLLISION_NODE_MAP } from './forcedMovementCollision.js'

type ForcedMovementNode = AllUnionFields<ForcedMovementAuthored>
type ForcedMovementNodeMapApi = Parameters<BuildNodeMap<ForcedMovementNode>['define']>[1] extends (
  api: infer TApi
) => void
  ? TApi
  : never

/** The condition builder a forced-movement field set is shown by. */
export type ForcedMovementCond = ForcedMovementNodeMapApi['cond']

/**
 * The one home for what a forced movement asks of an author: its direction, distance, action
 * economy and collision. A forced-movement outcome registers these beside its other effect-kind
 * fields; a nested forced movement (an escape check's `holderForcedMovement`) is this same set
 * under {@link FORCED_MOVEMENT_NODE_MAP}.
 */
export function registerForcedMovementOutcomeFields(
  map: ForcedMovementNodeMapApi['map'],
  nodes: ForcedMovementNodeMapApi['nodes'],
  cond: ForcedMovementNodeMapApi['cond'],
  logic: ForcedMovementNodeMapApi['logic']
) {
  const { number, selectSingle, groupObject } = nodes
  const { and, or } = logic
  const local = cond.local()
  const isForcedMovement = local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
  const hasDistance = and([
    isForcedMovement,
    or([local.field(['distanceMode']).eq('EXACT'), local.field(['distanceMode']).eq('UP_TO')])
  ])

  map
    .set(
      'direction',
      selectSingle(
        ['direction'],
        'Direction',
        { kind: 'INLINE_OPTIONS', options: FORCED_MOVEMENT_DIRECTION_OPTIONS },
        { requiredIf: true, showIf: isForcedMovement }
      )
    )
    .set(
      'distanceMode',
      selectSingle(
        ['distanceMode'],
        'Distance Mode',
        { kind: 'INLINE_OPTIONS', options: FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS },
        { requiredIf: true, showIf: isForcedMovement }
      )
    )
    .set(
      'movementAmount',
      number(['amount'], 'Distance Amount', { requiredIf: true, showIf: hasDistance })
    )
    .set(
      'movementUnit',
      selectSingle(
        ['unit'],
        'Distance Unit',
        { kind: 'INLINE_OPTIONS', options: LENGTH_UNIT_OPTIONS },
        { requiredIf: true, showIf: hasDistance }
      )
    )
    .set(
      'actionEconomy',
      selectSingle(
        ['actionEconomy'],
        'Action Economy',
        { kind: 'INLINE_OPTIONS', options: FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS },
        { requiredIf: true, showIf: isForcedMovement }
      )
    )
    .set(
      'collision',
      groupObject(['collision'], 'Collision', () => FORCED_MOVEMENT_COLLISION_NODE_MAP, {
        presentation: 'inline',
        showIf: isForcedMovement
      })
    )
}

const forcedMovement = buildNodeMap<ForcedMovementNode>()

/** A forced movement authored on its own, not as an outcome: always a FORCED_MOVEMENT effect. */
export const FORCED_MOVEMENT_NODE_MAP = forcedMovement.define(
  'forcedMovement',
  ({ map, nodes, cond, logic }) => {
    const { text, selectSingle } = nodes

    map.set('id', text(['id'], 'ID')).set(
      'effectKind',
      selectSingle(
        ['effectKind'],
        'Effect Kind',
        {
          kind: 'INLINE_OPTIONS',
          options: [{ code: EFFECT_KIND.FORCED_MOVEMENT, label: 'Forced Movement' }]
        },
        { requiredIf: true }
      )
    )
    registerForcedMovementOutcomeFields(map, nodes, cond, logic)
  }
)
