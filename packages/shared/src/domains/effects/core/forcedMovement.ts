import type { CoreMeta, LengthUnitCode } from '#core'
import { valuesOf } from '#utils'

export const FORCED_MOVEMENT_DIRECTION = {
  AWAY_FROM_SOURCE: 'AWAY_FROM_SOURCE',
  TOWARD_SOURCE: 'TOWARD_SOURCE',
  CHOICE: 'CHOICE'
} as const

export type ForcedMovementDirection = keyof typeof FORCED_MOVEMENT_DIRECTION

export type ForcedMovementDirectionOption = CoreMeta<ForcedMovementDirection>

export const FORCED_MOVEMENT_DIRECTION_REGISTRY: Record<
  ForcedMovementDirection,
  ForcedMovementDirectionOption
> = {
  [FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE]: {
    code: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE,
    label: 'Away From Source',
    description: 'Move away from the source of the effect.',
    tooltip: 'Move away from source.'
  },
  [FORCED_MOVEMENT_DIRECTION.TOWARD_SOURCE]: {
    code: FORCED_MOVEMENT_DIRECTION.TOWARD_SOURCE,
    label: 'Toward Source',
    description: 'Move toward the source of the effect.',
    tooltip: 'Move toward source.'
  },
  [FORCED_MOVEMENT_DIRECTION.CHOICE]: {
    code: FORCED_MOVEMENT_DIRECTION.CHOICE,
    label: 'Choice',
    description: 'Direction is selected by the effect or table rules.',
    tooltip: 'Direction is chosen by rule.'
  }
} as const

export const FORCED_MOVEMENT_DIRECTION_OPTIONS = valuesOf(
  FORCED_MOVEMENT_DIRECTION_REGISTRY
) as readonly ForcedMovementDirectionOption[]

export const FORCED_MOVEMENT_DISTANCE_MODE = {
  UP_TO_SPEED: 'UP_TO_SPEED',
  FIXED_DISTANCE: 'FIXED_DISTANCE'
} as const

export type ForcedMovementDistanceMode = keyof typeof FORCED_MOVEMENT_DISTANCE_MODE

export type ForcedMovementDistanceModeOption = CoreMeta<ForcedMovementDistanceMode>

export const FORCED_MOVEMENT_DISTANCE_MODE_REGISTRY: Record<
  ForcedMovementDistanceMode,
  ForcedMovementDistanceModeOption
> = {
  [FORCED_MOVEMENT_DISTANCE_MODE.UP_TO_SPEED]: {
    code: FORCED_MOVEMENT_DISTANCE_MODE.UP_TO_SPEED,
    label: 'Up To Speed',
    description: "Move up to the target's current speed.",
    tooltip: 'Up to speed.'
  },
  [FORCED_MOVEMENT_DISTANCE_MODE.FIXED_DISTANCE]: {
    code: FORCED_MOVEMENT_DISTANCE_MODE.FIXED_DISTANCE,
    label: 'Fixed Distance',
    description: 'Move a fixed distance value.',
    tooltip: 'Fixed distance.'
  }
} as const

export const FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS = valuesOf(
  FORCED_MOVEMENT_DISTANCE_MODE_REGISTRY
) as readonly ForcedMovementDistanceModeOption[]

export const FORCED_MOVEMENT_ACTION_ECONOMY = {
  NONE: 'NONE',
  REACTION: 'REACTION'
} as const

export type ForcedMovementActionEconomy = keyof typeof FORCED_MOVEMENT_ACTION_ECONOMY

export type ForcedMovementActionEconomyOption = CoreMeta<ForcedMovementActionEconomy>

export const FORCED_MOVEMENT_ACTION_ECONOMY_REGISTRY: Record<
  ForcedMovementActionEconomy,
  ForcedMovementActionEconomyOption
> = {
  [FORCED_MOVEMENT_ACTION_ECONOMY.NONE]: {
    code: FORCED_MOVEMENT_ACTION_ECONOMY.NONE,
    label: 'None',
    description: 'No explicit action-economy cost is consumed.',
    tooltip: 'No action cost.'
  },
  [FORCED_MOVEMENT_ACTION_ECONOMY.REACTION]: {
    code: FORCED_MOVEMENT_ACTION_ECONOMY.REACTION,
    label: 'Reaction',
    description: 'Consumes the target reaction when movement is executed.',
    tooltip: 'Consumes reaction.'
  }
} as const

export const FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS = valuesOf(
  FORCED_MOVEMENT_ACTION_ECONOMY_REGISTRY
) as readonly ForcedMovementActionEconomyOption[]

export type ForcedMovementDistance =
  | {
      distanceMode: typeof FORCED_MOVEMENT_DISTANCE_MODE.UP_TO_SPEED
    }
  | {
      distanceMode: typeof FORCED_MOVEMENT_DISTANCE_MODE.FIXED_DISTANCE
      amount: number
      unit: LengthUnitCode
    }
