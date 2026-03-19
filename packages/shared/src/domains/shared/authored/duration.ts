import type { DurationKind } from '#core'

export type DurationAuthored
  = | {
    id: string
    durationKind: Extract<DurationKind, 'INSTANTANEOUS'>
  }
  | {
    id: string
    durationKind: Extract<DurationKind, 'UNTIL_DISPELLED'>
  }
  | {
    id: string
    durationKind: Exclude<DurationKind, 'INSTANTANEOUS' | 'UNTIL_DISPELLED'>
    amount: number
  }
