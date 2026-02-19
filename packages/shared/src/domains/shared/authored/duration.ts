import type { DurationKind } from '#core'

export type DurationAuthored
  = | {
    id: string
    durationKind: Extract<DurationKind, 'INSTANTANEOUS'>
  }
  | {
    id: string
    durationKind: Exclude<DurationKind, 'INSTANTANEOUS'>
    amount: number
  }
