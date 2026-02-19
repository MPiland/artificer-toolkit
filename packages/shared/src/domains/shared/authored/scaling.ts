import type { ScalingSource, ScalingSourcePayload } from '#core'

export type LevelScaledValue<TPayload = object> = {
  [S in ScalingSource]: {
    levels: (
    {
      id: string
      level: number
      order: number
    } & TPayload
    )[]
  } & ScalingSourcePayload[S]
}[ScalingSource]

export type PoolScaledValue = {
  [S in ScalingSource]: {
    amount?: number
    multiplier?: number
    min?: number
    max?: number
  } & ScalingSourcePayload[S]
}[ScalingSource]
