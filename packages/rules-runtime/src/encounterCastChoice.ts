import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

/**
 * The options of an action whose one CHOICE path, under any path code, lets its caster pick at cast
 * (D140, D148): each is the action narrowed to its shared entries plus that option's, which keep
 * the option's own result kind. Null for an action with no such pick.
 */
export function castChoiceOptions(
  compiledEffect: CompiledEffectGroup
): { optionId: string; label: string; compiledEffect: CompiledEffectGroup }[] | null {
  const choiceEntries = compiledEffect.entries.filter((entry) => entry.groupKind === 'CHOICE')
  const picks = choiceEntries.flatMap((entry) =>
    'outcome' in entry &&
    entry.resolutionKind === 'DIRECT' &&
    entry.optionGroupKind !== undefined &&
    entry.label
      ? [{ entry, groupKind: entry.optionGroupKind, label: entry.label }]
      : []
  )
  const [first] = picks
  if (
    !first ||
    picks.length !== choiceEntries.length ||
    !picks.every(({ entry }) => entry.pathGroupId === first.entry.pathGroupId)
  )
    return null
  const labels = new Map(picks.map(({ entry, label }) => [entry.entryId, label]))
  if (labels.size < 2) return null
  return [...labels].map(([optionId, label]) => {
    const entries = compiledEffect.entries.flatMap((entry) => {
      if (entry.groupKind !== 'CHOICE') return [entry]
      const pick = picks.find((each) => each.entry === entry)
      if (pick?.entry.entryId !== optionId) return []
      const { optionGroupKind: _kind, ...picked } = pick.entry
      return [{ ...picked, groupKind: pick.groupKind }]
    })
    return { optionId, label, compiledEffect: { ...compiledEffect, entries } }
  })
}
