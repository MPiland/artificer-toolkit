import { assertNever } from '@artificer-toolkit/functions/utils'
import type { ModifierGrantAuthored } from '#authored'
import { AUTHORING_SELECTION_KIND, GRANT_KIND } from '#core'
import type {
  ModifierKind,
  ModifierScopeKind,
  ModifierValuePayload,
  Subject
} from '#core'
import type { CompiledTargetGroups } from '#compiler'
import { compileTargetGroups } from '#compiler'
import type { CompiledStaticGrant } from './grant.js'

/* ──────────────────────────────────────────────
 * Compiled type
 * ────────────────────────────────────────────── */

export type CompiledModifierGrant<
  S extends Subject = Subject,
  K extends ModifierKind = ModifierKind
> = CompiledStaticGrant<
  typeof GRANT_KIND.MODIFIER_GRANT,
  ModifierValuePayload<K>
> & {
  modifierKind: K
  scope: ModifierScopeKind
  targets?: CompiledTargetGroups<S>
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
    modifierKind: authored.modifierKind,

    restrictions: authored.restrictionGroups
      ? compileTargetGroups(authored.restrictionGroups)
      : undefined,

    targets: authored.targetGroups
      ? compileTargetGroups(authored.targetGroups)
      : undefined
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
