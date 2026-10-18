import type { ProficiencyGrantAuthored, ProficiencyKindPayload } from '#authored'
import type { GRANT_KIND, ProficiencyKind } from '#core'
import type { CompiledStaticGrant } from '#compilers'

/** One member per proficiency kind, so narrowing on the kind types its target payload. */
export type CompiledProficiencyGrant<T extends ProficiencyKind = ProficiencyKind> = {
  [K in T]: CompiledStaticGrant<typeof GRANT_KIND.PROFICIENCY_GRANT, ProficiencyKindPayload[K]> & {
    proficiencyKind: K
  }
}[T]

export function compileProficiencyGrant(
  authored: ProficiencyGrantAuthored
): CompiledProficiencyGrant {
  const { restrictions: _restrictions, scalingKind: _scalingKind, ...compiled } = authored
  return compiled
}
