import { assertNever, compileSuccess, unwrapCompileResult, type CompileResult } from '#utils'

import type { GrantPayloadAuthored, FeatGrantAuthored } from '#authored'
import { AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, GRANT_KIND, SCALING } from '#core'
import type { CompiledCharge, CompiledGrantTarget, CompiledScalingGrant } from '#compilers'
import { compileCharge, compileScalingSource } from '#compilers'

export type CompiledFeatGrant = CompiledScalingGrant<
  typeof GRANT_KIND.FEAT_GRANT,
  CompiledGrantTarget<{ featIds: string[] }>
> & {
  charges?: CompiledCharge
}

// IMPORTANT: return `authored` for ALL so you don't drop extra fields (like `count`)
function compileFeatTarget(
  authored: GrantPayloadAuthored<{ featIds: string[] }>
): CompiledGrantTarget<{ featIds: string[] }> {
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

export function compileFeatGrantResult(
  authored: FeatGrantAuthored
): CompileResult<CompiledFeatGrant> {
  const base = {
    id: authored.id,
    order: authored.order
  }

  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.GRANTED: {
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.FEAT_GRANT,
            charges,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            ...compileFeatTarget(authored)
          })
        }

        case AUTHORING_SELECTION_KIND.CHOSEN: {
          // count stays inside payload in your CompiledGrantScalingNone<...> type
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.FEAT_GRANT,
            charges,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.NONE,
            ...compileFeatTarget(authored),
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
            grantKind: GRANT_KIND.FEAT_GRANT,
            charges,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            ...compileScalingSource(authored.progression),
            levels: authored.progression.levels.map((entry) => ({
              level: entry.level,
              ...compileFeatTarget(entry),
              order: entry.order
            }))
          })
        }

        case AUTHORING_SELECTION_KIND.CHOSEN: {
          // count is inside entry.payload (and compileFeatTarget preserves it)
          return compileSuccess({
            ...base,
            grantKind: GRANT_KIND.FEAT_GRANT,
            charges,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            ...compileScalingSource(authored.progression),
            levels: authored.progression.levels.map((entry) => ({
              level: entry.level,
              ...compileFeatTarget(entry),
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

export function compileFeatGrant(authored: FeatGrantAuthored): CompiledFeatGrant {
  return unwrapCompileResult(compileFeatGrantResult(authored))
}
