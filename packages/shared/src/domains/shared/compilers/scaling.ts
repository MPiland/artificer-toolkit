import { SCALING_SOURCE, type ScalingSourceAuthored } from '#core'
import { assertNever } from '@artificer-toolkit/functions/utils'

export type CompiledScalingSource = ScalingSourceAuthored

export function compileScalingSource(
  authored: ScalingSourceAuthored
): CompiledScalingSource {
  switch (authored.scalingSource) {
    case SCALING_SOURCE.CHARACTER_LEVEL:
      return { scalingSource: SCALING_SOURCE.CHARACTER_LEVEL }

    case SCALING_SOURCE.CLASS_LEVEL:
      return {
        scalingSource: SCALING_SOURCE.CLASS_LEVEL,
        classId: authored.classId
      }

    case SCALING_SOURCE.SPELL_LEVEL:
      return {
        scalingSource: SCALING_SOURCE.SPELL_LEVEL,
        spellId: authored.spellId
      }

    default:
      return assertNever(authored)
  }
}

export type ForbidIfMissing<
  C,
  Map extends Record<PropertyKey, object>
>
  = C extends keyof Map
    ? Map[C]
    : {
        [K in keyof Map[keyof Map]]?: never
      }
