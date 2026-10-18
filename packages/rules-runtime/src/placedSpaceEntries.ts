import type { CompiledEffectGroup, CompiledManifest } from '@artificer-toolkit/shared/compilers'

export type PlacedSpaceManifest = Exclude<
  CompiledManifest,
  { manifestKind: 'CREATURE' } | { manifestKind: 'SUMMON' }
>

/**
 * The zone manifest of an action whose ON_USE entries are one PLACED_SPACE or SOURCE zone and at
 * most one APPLY_GRANT beside it (D153), with that grant's entry, and whose other entries are the
 * outcomes of the save its invocation makes when the zone appears; null for any other action. Identification
 * only, with no Encounter dependency, so the Builder can tell a passive zone apart (ADR 0036 S6).
 */
export function placedSpaceEntries(compiledEffect: CompiledEffectGroup): {
  manifest: PlacedSpaceManifest
  entry: CompiledEffectGroup['entries'][number]
  sourceGrantEntry: CompiledEffectGroup['entries'][number] | null
} | null {
  const onUse = compiledEffect.entries.filter((entry) => entry.pathCode === 'ON_USE')
  const saved = compiledEffect.invocation.triggerCode === 'SAVING_THROW'
  if (
    compiledEffect.entries.some(
      (entry) =>
        entry.pathCode !== 'ON_USE' &&
        (!saved || (entry.pathCode !== 'ON_SAVE_FAIL' && entry.pathCode !== 'ON_SAVE_SUCCESS'))
    )
  )
    return null
  const zones = onUse.filter(
    (entry) =>
      'outcome' in entry &&
      entry.outcome.effectKind === 'MANIFEST' &&
      entry.outcome.manifestKind === 'ZONE' &&
      (entry.outcome.attachmentKind === 'PLACED_SPACE' || entry.outcome.attachmentKind === 'SOURCE')
  )
  const [zone] = zones
  const others = onUse.filter((entry) => entry !== zone)
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
