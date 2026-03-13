import { assertNever } from '#utils'

import type { GrantPayloadAuthored, SpellGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND
} from '#core'
import {
  compileScalingSource
} from '#compilers'
import type {
  CompiledScalingGrant,
  CompiledGrantTarget
} from '#compilers'
import { SCALING } from '#core'
import type { SpellGrantAttribute } from '#core'

export type CompiledSpellGrant = CompiledScalingGrant<
  typeof GRANT_KIND.SPELL_GRANT,
  CompiledGrantTarget<{ spellIds: string[] }>
> & {
  castAtLevel?: number
  attributes?: SpellGrantAttribute[]
}

function compileSpellTarget(
  authored: GrantPayloadAuthored<{ spellIds: string[] }>
): CompiledGrantTarget<{ spellIds: string[] }> {
  switch (authored.authoringModeKind) {
    case AUTHORING_MODE_KIND.ALL:
    case AUTHORING_MODE_KIND.SELECTED:
      return authored

    default:
      return assertNever(authored)
  }
}

export function compileSpellGrant(
  authored: SpellGrantAuthored
): CompiledSpellGrant {
  const base = {
    id: authored.id,
    castAtLevel: authored.castAtLevel,
    attributes:
      authored.attributes && authored.attributes.length ? authored.attributes : undefined,
    order: authored.order
  }

  switch (authored.scalingKind) {
    case SCALING.NONE: {
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.GRANTED: {
          return {
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            ...compileSpellTarget(authored)
          }
        }

        case AUTHORING_SELECTION_KIND.CHOSEN: {
          return {
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.NONE,
            ...compileSpellTarget(authored),
            count: authored.count
          }
        }

        default:
          return assertNever(authored)
      }
    }

    case SCALING.PER_LEVEL: {
      switch (authored.selectionKind) {
        case AUTHORING_SELECTION_KIND.CHOSEN: {
          return {
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            ...compileScalingSource(authored.scaling),
            levels: authored.scaling.levels.map((entry) => ({
              level: entry.level,
              count: entry.count,
              order: entry.order,
              ...compileSpellTarget(entry)
            }))
          }
        }

        case AUTHORING_SELECTION_KIND.GRANTED: {
          return {
            ...base,
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED, // <- literal
            scalingKind: SCALING.PER_LEVEL,
            ...compileScalingSource(authored.scaling),
            levels: authored.scaling.levels.map((entry) => ({
              level: entry.level,
              order: entry.order,
              ...compileSpellTarget(entry)
            }))
          }
        }

        default:
          return assertNever(authored)
      }
    }

    default:
      return assertNever(authored)
  }
}
