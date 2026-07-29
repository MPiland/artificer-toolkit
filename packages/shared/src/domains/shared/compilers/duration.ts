import type { DurationAuthored } from '#authored'
import { DURATION_KIND, DurationKind, type ScalableValueAuthored } from '#core'
import { assertNever } from '#utils'

export type CompiledDuration = {
  [K in DurationKind]: K extends
    | typeof DURATION_KIND.INSTANTANEOUS
    | typeof DURATION_KIND.UNTIL_DISPELLED
    ? {
        durationKind: K
      }
    : {
        durationKind: K
        amount: number
        scaling?: ScalableValueAuthored<{ amount: number }>
      }
}[DurationKind]

export function compileDuration(authored: DurationAuthored): CompiledDuration {
  switch (authored.durationKind) {
    case DURATION_KIND.INSTANTANEOUS: {
      return {
        durationKind: DURATION_KIND.INSTANTANEOUS
      }
    }

    case DURATION_KIND.UNTIL_DISPELLED: {
      return {
        durationKind: DURATION_KIND.UNTIL_DISPELLED
      }
    }

    case DURATION_KIND.DAY:
    case DURATION_KIND.HOUR:
    case DURATION_KIND.MINUTE:
    case DURATION_KIND.MONTH:
    case DURATION_KIND.ROUND:
    case DURATION_KIND.TURN:
    case DURATION_KIND.YEAR:
    case DURATION_KIND.WEEK:
      return {
        durationKind: authored.durationKind,
        amount: authored.amount,
        ...(authored.scaling ? { scaling: authored.scaling } : {})
      }

    default:
      return assertNever(authored)
  }
}
