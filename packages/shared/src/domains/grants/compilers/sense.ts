import { assertNever, compileSuccess, unwrapCompileResult, type CompileResult } from '#utils'

import type { GrantPayloadAuthored, SenseGrantAuthored } from '#authored'
import { AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, GRANT_KIND } from '#core'
import { compileChargeUse, compileRange, compileScalingSource } from '#compilers'
import type {
  CompiledGrantTarget,
  CompiledScalingGrant,
  CompiledChargeUse,
  CompiledRange
} from '#compilers'
import { SCALING } from '#core'

export type CompiledSenseRange =
  | Extract<CompiledRange, { rangeKind: 'DISTANCE' }>
  | { id: string; rangeKind: 'UNLIMITED' }

export type CompiledSenseGrant = CompiledScalingGrant<
  typeof GRANT_KIND.SENSE_GRANT,
  CompiledGrantTarget<{ senseIds: string[] }>
> & {
  charges?: CompiledChargeUse
  range: CompiledSenseRange
}

// IMPORTANT: return `authored` for ALL so you don't drop extra fields (like `count`)
function compileSenseTarget(
  authored: GrantPayloadAuthored<{ senseIds: string[] }>
): CompiledGrantTarget<{ senseIds: string[] }> {
  switch (authored.authoringModeKind) {
    case undefined:
    case AUTHORING_MODE_KIND.ALL:
      return { authoringModeKind: AUTHORING_MODE_KIND.ALL }

    case AUTHORING_MODE_KIND.SELECTED:
      return authored

    default:
      return assertNever(authored)
  }
}

export function compileSenseGrantResult(
  authored: SenseGrantAuthored
): CompileResult<CompiledSenseGrant> {
  const base = {
    id: authored.id,
    order: authored.order
  }

  const charges = authored.charges ? compileChargeUse(authored.charges) : undefined
  const range: CompiledSenseRange =
    authored.range.rangeKind === 'DISTANCE'
      ? compileRange(authored.range)
      : { id: authored.range.id, rangeKind: authored.range.rangeKind }

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.GRANTED: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SENSE_GRANT,
            charges,
            range,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            ...compileSenseTarget(authored)
          })
        }

        case AUTHORING_SELECTION_KIND.CHOSEN: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SENSE_GRANT,
            charges,
            range,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.NONE,
            ...compileSenseTarget(authored),
            count: authored.count,
            selectionDuplicatePolicy: authored.selectionDuplicatePolicy
          })
        }

        default:
          return assertNever(authored)
      }
    }

    case SCALING.PER_LEVEL: {
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.GRANTED: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SENSE_GRANT,
            charges,
            range,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            ...compileScalingSource(authored.progression),
            levels: authored.progression.levels.map((entry) => ({
              level: entry.level,
              ...compileSenseTarget(entry),
              order: entry.order
            }))
          })
        }

        case AUTHORING_SELECTION_KIND.CHOSEN: {
          // count is inside entry.value (and compileSenseTarget preserves it)
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.SENSE_GRANT,
            charges,
            range,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            ...compileScalingSource(authored.progression),
            levels: authored.progression.levels.map((entry) => ({
              level: entry.level,
              ...compileSenseTarget(entry),
              order: entry.order,
              count: entry.count,
              selectionDuplicatePolicy: entry.selectionDuplicatePolicy
            }))
          })
        }

        default:
          return assertNever(authored)
      }
    }

    default:
      return assertNever(authored)
  }
}

export function compileSenseGrant(authored: SenseGrantAuthored): CompiledSenseGrant {
  return unwrapCompileResult(compileSenseGrantResult(authored))
}
