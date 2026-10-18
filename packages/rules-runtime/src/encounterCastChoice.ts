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
  const [first] = choiceEntries
  if (
    !first ||
    !choiceEntries.every(
      (entry) =>
        'outcome' in entry &&
        entry.resolutionKind === 'DIRECT' &&
        entry.optionGroupKind !== undefined &&
        entry.pathGroupId === first.pathGroupId &&
        entry.label !== undefined
    )
  )
    return null
  const optionIds = [...new Set(choiceEntries.map(({ entryId }) => entryId))]
  if (optionIds.length < 2) return null
  return optionIds.map((optionId) => {
    const entries = compiledEffect.entries.flatMap((entry) => {
      if (entry.groupKind !== 'CHOICE') return [entry]
      if (entry.entryId !== optionId || !('outcome' in entry) || entry.resolutionKind !== 'DIRECT')
        return []
      const { optionGroupKind, ...picked } = entry
      return [{ ...picked, groupKind: optionGroupKind ?? 'SINGLE' }]
    })
    const label = choiceEntries.find((entry) => entry.entryId === optionId)?.label ?? ''
    return { optionId, label, compiledEffect: { ...compiledEffect, entries } }
  })
}
