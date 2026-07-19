import { compileSuccess, unwrapCompileResult, type CompileResult } from '#utils'
import type { FacetAuthored, ModifierGrantAuthored } from '#authored'
import { GRANT_KIND } from '#core'
import type { ModifierKind, ModifierScopeKind } from '#core'
import type { CompiledStaticGrant } from './grant.js'

/* ──────────────────────────────────────────────
 * Compiled type
 * ────────────────────────────────────────────── */

export type CompiledModifierGrant<K extends ModifierKind = ModifierKind> = CompiledStaticGrant<
  typeof GRANT_KIND.MODIFIER_GRANT,
  ModifierGrantAuthored
> & {
  modifierKind: K
  scope: ModifierScopeKind
  /**
   * Restriction facet carried from the authored grant.
   * The engine evaluates this at two points:
   * - CHARACTER-subject contexts: gate whether the grant is collected at all
   *   (e.g. character must have SPELL_OBTAINED: Eldritch Blast)
   * - Non-CHARACTER subject contexts (SPELL, EQUIPMENT, etc.): tag the
   *   modifier entry with scope IDs so the character sheet can display
   *   where the modifier applies (e.g. scopeSpellIds: [ELDRITCH_BLAST_ID])
   */
  restrictions?: FacetAuthored
}

/* ──────────────────────────────────────────────
 * Compiler
 * ────────────────────────────────────────────── */

export function compileModifierGrantResult(
  authored: ModifierGrantAuthored
): CompileResult<CompiledModifierGrant> {
  const base = {
    id: authored.id,
    order: authored.order,

    scope: authored.scope,
    modifierKind: authored.modifierKind
  }

  const { id: _id, ...rest } = authored
  return compileSuccess({
    ...base,
    ...rest
  })
}

export function compileModifierGrant(authored: ModifierGrantAuthored): CompiledModifierGrant {
  return unwrapCompileResult(compileModifierGrantResult(authored))
}
