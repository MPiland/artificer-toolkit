import {
  COMPILE_DIAGNOSTIC_SEVERITY,
  compileFailure,
  compileSuccess,
  unwrapCompileResult,
  type CompileResult
} from '#utils'
import type { FacetAuthored, ModifierGrantAuthored } from '#authored'
import { MODIFIER_KINDS_BY_DOMAIN } from '#core'
import type {
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  ModifierKind,
  ModifierScopeKind,
  ValueDomainCode,
  ValueDomainParam
} from '#core'
import type { CompiledGrantBase } from './grant.js'

/* ──────────────────────────────────────────────
 * Compiled type
 * ────────────────────────────────────────────── */

/**
 * One flat modifier grant: value domain and modifier kind are independent fields, so engine
 * transforms can spread and override them. The compiler checks the kind against the domain.
 */
export type CompiledModifierGrant = CompiledGrantBase & {
  grantKind: typeof GRANT_KIND.MODIFIER_GRANT
  selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
  valueDomainCode: ValueDomainCode
  modifierKind: ModifierKind
  scope: ModifierScopeKind
  domain: ValueDomainParam<ValueDomainCode>
  /** A payload some supported domain and kind takes, not every kind's payload for every domain. */
  payload?: NonNullable<ModifierGrantAuthored['payload']>
  /**
   * Restriction facet carried from the authored grant.
   * The engine evaluates this at two points:
   * - CHARACTER-subject contexts: gate whether the grant is collected at all
   *   (e.g. character must have SPELL_OBTAINED: Eldritch Blast)
   * - SPELL and EQUIPMENT contexts: deferred conditions decided against the
   *   cast spell or the attacking item (e.g. Eldritch Blast only)
   */
  restrictions?: FacetAuthored
}

/* ──────────────────────────────────────────────
 * Compiler
 * ────────────────────────────────────────────── */

export function compileModifierGrantResult(
  authored: ModifierGrantAuthored
): CompileResult<CompiledModifierGrant> {
  const supportedKinds: readonly ModifierKind[] = MODIFIER_KINDS_BY_DOMAIN[authored.valueDomainCode]
  if (!supportedKinds.includes(authored.modifierKind)) {
    return compileFailure({
      code: 'MODIFIER_KIND_UNSUPPORTED_FOR_DOMAIN',
      message: `${authored.valueDomainCode} does not support ${authored.modifierKind} modifiers.`,
      severity: COMPILE_DIAGNOSTIC_SEVERITY.ERROR,
      path: ['modifierKind']
    })
  }

  return compileSuccess({
    id: authored.id,
    order: authored.order,
    grantKind: authored.grantKind,
    selectionKind: authored.selectionKind,
    valueDomainCode: authored.valueDomainCode,
    modifierKind: authored.modifierKind,
    scope: authored.scope,
    domain: authored.domain,
    ...(authored.payload === undefined ? {} : { payload: authored.payload }),
    ...(authored.restrictions === undefined ? {} : { restrictions: authored.restrictions })
  })
}

export function compileModifierGrant(authored: ModifierGrantAuthored): CompiledModifierGrant {
  return unwrapCompileResult(compileModifierGrantResult(authored))
}
