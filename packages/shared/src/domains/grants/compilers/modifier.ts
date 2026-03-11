import { assertNever } from '@artificer-toolkit/functions/utils'
import type { ModifierGrantAuthored } from '#authored'
import { AUTHORING_SELECTION_KIND, GRANT_KIND } from '#core'
import type {
  ModifierKind,
  ModifierScopeKind
} from '#core'
import type { CompiledStaticGrant } from './grant.js'

/* ──────────────────────────────────────────────
 * Compiled type
 * ────────────────────────────────────────────── */

export type CompiledModifierGrant<
  K extends ModifierKind = ModifierKind
> = CompiledStaticGrant<
  typeof GRANT_KIND.MODIFIER_GRANT,
  ModifierGrantAuthored
> & {
  modifierKind: K
  scope: ModifierScopeKind
}

/* ──────────────────────────────────────────────
 * Compiler
 * ────────────────────────────────────────────── */

export function compileModifierGrant(
  authored: ModifierGrantAuthored
): CompiledModifierGrant {
  const base = {
    id: authored.id,
    order: authored.order,

    scope: authored.scope,
    modifierKind: authored.modifierKind
  }

  switch (authored.selectionKind) {
    case AUTHORING_SELECTION_KIND.GRANTED: {
      const { id: _id, ...rest } = authored
      return {
        ...base,
        ...rest
      }
    }

    case AUTHORING_SELECTION_KIND.CHOSEN: {
      const { id: _id, ...rest } = authored
      return {
        ...base,
        ...rest,

        // invariant: count only on CHOSEN
        count: authored.count
      }
    }

    default:
      return assertNever(authored)
  }
}
