import type { CompiledEffectGroup, CompiledManifest } from '@artificer-toolkit/shared/compilers'

export type PlacedSpaceManifest = Exclude<
  CompiledManifest,
  { manifestKind: 'CREATURE' } | { manifestKind: 'SUMMON' }
>

/**
 * The zone manifest of an action whose entries are one PLACED_SPACE or SOURCE zone and at most one
 * APPLY_GRANT beside it (D153), with that grant's entry; null for any other action. Identification
 * only, with no Encounter dependency, so the Builder can tell a passive zone apart (ADR 0036 S6).
 */
export function placedSpaceEntries(compiledEffect: CompiledEffectGroup): {
  manifest: PlacedSpaceManifest
  entry: CompiledEffectGroup['entries'][number]
  sourceGrantEntry: CompiledEffectGroup['entries'][number] | null
} | null {
  const zones = compiledEffect.entries.filter(
    (entry) =>
      'outcome' in entry &&
      entry.outcome.effectKind === 'MANIFEST' &&
      entry.outcome.manifestKind === 'ZONE' &&
      (entry.outcome.attachmentKind === 'PLACED_SPACE' || entry.outcome.attachmentKind === 'SOURCE')
  )
  const [zone] = zones
  const others = compiledEffect.entries.filter((entry) => entry !== zone)
  if (
    zones.length !== 1 ||
    !zone ||
    !('outcome' in zone) ||
    others.length > 1 ||
    others.some((entry) => !('outcome' in entry) || entry.outcome.effectKind !== 'APPLY_GRANT')
  )
    return null
  return {
    manifest: zone.outcome as PlacedSpaceManifest,
    entry: zone,
    sourceGrantEntry: others[0] ?? null
  }
}
