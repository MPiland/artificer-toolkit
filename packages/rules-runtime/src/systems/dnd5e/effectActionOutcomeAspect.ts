import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import { unsupported, type TestKind } from './effectActionContracts.js'
import { DND5E_TEST_RESULT_PATHS, type Dnd5eTestKind } from './effectActionTest.js'
import { hasLifecycleOverride } from './effectActionTestOutcomes.js'

type CompiledEntry = CompiledEffectGroup['entries'][number]
/** An entry that resolves directly on its path: the only kind that carries an outcome to compose. */
export type Dnd5eOutcomeEntry = Extract<CompiledEntry, { resolutionKind: 'DIRECT' }>

/**
 * What the action's plans carry beside its outcome graph, which the outcome aspect reads and does
 * not decide (the lifetime aspect does):
 * - `sequence`: a sequence's later outcomes, each its own OUTCOME group or held by a plan;
 * - `choice`: a choice's options, as a repeated save's lead (Power Word Stun) holds them;
 * - `lifetime`: an entry's duration, lifecycle or maintained effect.
 */
export type Dnd5eOutcomeCarriers = Readonly<{
  sequence: boolean
  choice: boolean
  lifetime: (entry: Dnd5eOutcomeEntry) => boolean
}>

/**
 * The outcome aspect's rule for one entry (ADR 0039 decision 1): it resolves directly, as one
 * outcome or as a sequence or choice its carriers hold, on a result path its test resolves to, with
 * no range or targeting of its own, and outlasts its use only when a plan holds its lifetime.
 */
function composesOutcome(
  entry: CompiledEntry,
  paths: readonly string[],
  carriers: Dnd5eOutcomeCarriers
): entry is Dnd5eOutcomeEntry {
  if (entry.resolutionKind !== 'DIRECT') return false
  return (
    (entry.groupKind === 'SINGLE' ||
      (entry.groupKind === 'SEQUENTIAL' && carriers.sequence) ||
      (entry.groupKind === 'CHOICE' && carriers.choice)) &&
    paths.includes(entry.pathCode) &&
    !entry.rangeOverride &&
    !entry.targetingOverride &&
    (!(hasLifecycleOverride(entry) || entry.maintenanceDefinitionId) || carriers.lifetime(entry))
  )
}

/**
 * The one result an action that rolls no attack or save applies, on use or on its check's success.
 * A repeated save (Power Word Stun) follows it as the action's second entry, which its plan holds.
 */
export function dnd5eDirectOutcomeEntry(
  entries: readonly CompiledEntry[],
  input: Readonly<{
    test: Dnd5eTestKind
    repeatsSave: boolean
    carriers: Dnd5eOutcomeCarriers
  }>
): Dnd5eOutcomeEntry {
  const entry = entries[0]
  if (
    entries.length !== (input.repeatsSave ? 2 : 1) ||
    !entry ||
    !composesOutcome(entry, DND5E_TEST_RESULT_PATHS[input.test], input.carriers)
  )
    unsupported('D&D Effect action must have one fixed direct result without lifecycle overrides.')
  return entry
}

/**
 * The outcomes an attack or save applies on its result paths, each composed on its own path. Entries
 * `planned` names (a plan's own outcomes, a roll table's rows) compose elsewhere; at most one entry
 * holds the action's relationship.
 */
export function dnd5eTestOutcomeEntries(
  entries: readonly CompiledEntry[],
  input: Readonly<{
    test: TestKind
    carriers: Dnd5eOutcomeCarriers
    planned: (entry: CompiledEntry) => boolean
  }>
): readonly Dnd5eOutcomeEntry[] {
  if (
    entries.filter(
      (entry) => 'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
    ).length > 1
  )
    unsupported('D&D action has more than one relationship outcome.')
  return entries
    .filter((entry) => !input.planned(entry))
    .map((entry) =>
      composesOutcome(entry, DND5E_TEST_RESULT_PATHS[input.test], input.carriers)
        ? entry
        : unsupported('D&D test action paths must be unique direct outcomes.')
    )
}
