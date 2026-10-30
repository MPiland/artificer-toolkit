import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { unsupported, type Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { publishedGraph } from './effectActionPublishedGraph.js'

export type CompiledOutcomeEntry = Extract<
  CompiledEffectGroup['entries'][number],
  { outcome: unknown }
>

/**
 * A cast of SEQUENTIAL entries held in one active effect (D156): at most one grant and at most one
 * recurring heal, the effect-bearing entries, with at most one immediate heal beside them. They
 * share the target, the duration and the maintenance, and no test decides them. Null for any other
 * action.
 */
export function sequentialComposition(action: Dnd5eCompiledEffectActionSource): null | {
  grant: CompiledOutcomeEntry | null
  recurring: CompiledOutcomeEntry | null
  immediate: CompiledOutcomeEntry | null
} {
  const { invocation, entries } = action.compiledEffect
  if (entries.length < 2 || invocation.kind !== 'ACTION' || invocation.triggerCode !== 'ACTIVATED')
    return null
  const composed = entries.filter(
    (entry): entry is CompiledOutcomeEntry =>
      'outcome' in entry &&
      entry.resolutionKind === 'DIRECT' &&
      entry.groupKind === 'SEQUENTIAL' &&
      entry.pathCode === 'ON_USE' &&
      !entry.rangeOverride &&
      !entry.targetingOverride
  )
  const [first] = composed
  const durationKey = (entry: CompiledOutcomeEntry) =>
    entry.duration
      ? JSON.stringify([
          entry.duration.durationKind,
          'amount' in entry.duration ? entry.duration.amount : null
        ])
      : null
  if (
    !first ||
    composed.length !== entries.length ||
    composed.some(
      (entry) =>
        durationKey(entry) !== durationKey(first) ||
        entry.maintenanceDefinitionId !== first.maintenanceDefinitionId
    )
  )
    return null
  const grants = composed.filter(({ outcome }) => outcome.effectKind === 'APPLY_GRANT')
  const heals = composed.filter(({ outcome }) => outcome.effectKind === 'HEAL')
  const recurring = heals.filter(({ lifecycle }) => lifecycle?.recurringKind !== undefined)
  const immediate = heals.filter(({ lifecycle }) => lifecycle === undefined)
  if (
    grants.length + recurring.length + immediate.length !== composed.length ||
    grants.length > 1 ||
    recurring.length > 1 ||
    immediate.length > 1 ||
    grants.length + recurring.length === 0
  )
    return null
  return {
    grant: grants[0] ?? null,
    recurring: recurring[0] ?? null,
    immediate: immediate[0] ?? null
  }
}

/** The action narrowed to one of its entries, as a cast of that entry alone would author it. */
export function singleEntryAction(
  action: Dnd5eCompiledEffectActionSource,
  entry: CompiledOutcomeEntry
): Dnd5eCompiledEffectActionSource {
  return {
    ...action,
    compiledEffect: { ...action.compiledEffect, entries: [{ ...entry, groupKind: 'SINGLE' }] }
  }
}

/**
 * An ON_USE SEQUENCE whose other outcomes are all GM rulings (D156): its one executable outcome
 * compiles as the action's result, and each ruling stays beside it as a manual-adjudication node.
 * A sequence with two executable outcomes is not split, so the one-result rule refuses it.
 */
export function rulingSequence(action: Dnd5eCompiledEffectActionSource): {
  executable: Dnd5eCompiledEffectActionSource
  rulings: readonly Dnd5eCompiledEffectActionSource['compiledEffect']['entries'][number][]
} | null {
  const { entries } = action.compiledEffect
  if (
    entries.length < 2 ||
    !entries.every(
      (entry) =>
        entry.resolutionKind === 'DIRECT' &&
        entry.groupKind === 'SEQUENTIAL' &&
        entry.pathCode === 'ON_USE'
    )
  )
    return null
  const isRuling = (entry: (typeof entries)[number]) =>
    'outcome' in entry && entry.outcome.effectKind === 'MANUAL_ADJUDICATION'
  const rulings = entries.filter(isRuling)
  const executable = entries.filter((entry) => !isRuling(entry))
  if (executable.length !== 1) return null
  return {
    executable: {
      ...action,
      compiledEffect: {
        ...action.compiledEffect,
        entries: [{ ...executable[0]!, groupKind: 'SINGLE' }]
      }
    },
    rulings
  }
}

/**
 * An ON_USE SEQUENCE of direct results (END_EFFECTS then APPLY_GRANT, RULES-2.T6h): each result is
 * the cast of that entry alone, with its own duration and plan, and the action runs them in authored
 * order in one commit. The cast of each is returned in that order; null for any other action,
 * including the sequences with a ruling or a composed heal and grant, which have homes of their own.
 */
export function directResultSequence(
  action: Dnd5eCompiledEffectActionSource,
  holdsLastingEffect: (action: Dnd5eCompiledEffectActionSource) => boolean
): Dnd5eCompiledEffectActionSource[] | null {
  const { invocation, entries } = action.compiledEffect
  if (
    entries.length < 2 ||
    invocation.kind !== 'ACTION' ||
    invocation.triggerCode !== 'ACTIVATED' ||
    rulingSequence(action) ||
    sequentialComposition(action)
  )
    return null
  const results = entries.filter(
    (entry): entry is CompiledOutcomeEntry =>
      'outcome' in entry &&
      entry.resolutionKind === 'DIRECT' &&
      entry.groupKind === 'SEQUENTIAL' &&
      entry.pathCode === 'ON_USE' &&
      // A follow-up save belongs to the effect it follows; that result's own plan carries it.
      entry.outcome.effectKind !== 'FOLLOW_UP_SAVE' &&
      !entry.rangeOverride &&
      !entry.targetingOverride
  )
  if (results.length !== entries.length) return null
  // The sequence's result block states one duration, lifecycle and chosen item for all its results,
  // but only a result that holds a lasting effect has a use for them: the others (END_EFFECTS) are
  // instant.
  return results.map((entry) => {
    const alone = singleEntryAction(action, entry)
    if (holdsLastingEffect(alone)) return alone
    const {
      duration: _duration,
      lifecycle: _lifecycle,
      chosenItem: _chosenItem,
      maintenanceDefinitionId: _maintenance,
      ...instant
    } = entry
    return singleEntryAction(action, instant)
  })
}

/**
 * The graph of a direct result sequence: the compiled graphs of its results side by side in
 * authored order. Results that would share a node or an output port (two heals) are refused, since the commit
 * could not tell their amounts apart.
 */
export function mergeDirectResultGraphs(
  definitions: readonly RuleGraphDefinition[]
): ServerPublishedRuleDefinitionDto {
  const [first] = definitions
  if (!first) unsupported('D&D direct result sequence has no result.')
  const nodes = definitions.flatMap((definition) => definition.nodes)
  if (new Set(nodes.map(({ id }) => id)).size !== nodes.length)
    unsupported('D&D direct results of one kind cannot share a cast.')
  const outputs: Record<string, RuleGraphDefinition['outputs'][string]> = {}
  for (const definition of definitions) {
    for (const [port, binding] of Object.entries(definition.outputs)) {
      // Every result lands on the one target: the first result's binding stands for all of them.
      if (port in outputs && port !== 'targetActorId')
        unsupported('D&D direct results cannot share the output ' + port + '.')
      outputs[port] ??= binding
    }
  }
  const sourceEntryBindings = definitions.flatMap(
    (definition) => definition.sourceEntryBindings ?? []
  )
  return publishedGraph({
    ...first,
    nodes,
    outputs,
    ...(sourceEntryBindings.length > 0 && { sourceEntryBindings })
  })
}
