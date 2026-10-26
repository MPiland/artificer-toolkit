import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { CastChoiceUnavailableError } from './encounterErrors.js'

/**
 * The options of an action whose one CHOICE path, under any path code, lets its caster pick at cast
 * (D140, D148): each is the action narrowed to its shared entries plus that option's, which keep
 * the option's own result kind. Null for an action with no such pick.
 */
export function castChoiceOptions(compiledEffect: CompiledEffectGroup):
  | {
      optionId: string
      label: string
      requiresOptionalRule?: { definitionId: string }
      compiledEffect: CompiledEffectGroup
    }[]
  | null {
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
    const requiresOptionalRule = picks.find(({ entry }) => entry.entryId === optionId)?.entry
      .requiresOptionalRule
    return {
      optionId,
      label,
      ...(requiresOptionalRule && { requiresOptionalRule }),
      compiledEffect: { ...compiledEffect, entries }
    }
  })
}

/**
 * The options of a pick the Encounter offers: an option that requires an optional combat rule is
 * offered only while that rule is among the Encounter's active ones (`activeOptionalCombatDefinitions`).
 */
export function offeredCastChoiceOptions<
  Option extends { requiresOptionalRule?: { definitionId: string } }
>(options: readonly Option[], activeOptionalRules: readonly { definitionId: string }[]): Option[] {
  return options.filter(
    ({ requiresOptionalRule }) =>
      !requiresOptionalRule ||
      activeOptionalRules.some(
        ({ definitionId }) => definitionId === requiresOptionalRule.definitionId
      )
  )
}

/**
 * The action as the option its actor picked (D148), or as its first offered option for a read of
 * the test every option shares; an action with no pick runs whole. A pick the action does not
 * offer in this Encounter, or a missing one, is refused.
 */
export function pickedCastChoiceEffect(
  compiledEffect: CompiledEffectGroup,
  choiceOptionId: string | undefined,
  activeOptionalRules: readonly { definitionId: string }[],
  readsSharedTest = false
): CompiledEffectGroup {
  const allOptions = castChoiceOptions(compiledEffect)
  if (!allOptions) {
    if (choiceOptionId !== undefined) throw new CastChoiceUnavailableError()
    return compiledEffect
  }
  const options = offeredCastChoiceOptions(allOptions, activeOptionalRules)
  const picked =
    options.find(({ optionId }) => optionId === choiceOptionId) ??
    (readsSharedTest ? options[0] : undefined)
  if (!picked) throw new CastChoiceUnavailableError()
  return picked.compiledEffect
}
