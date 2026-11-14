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

const DIRECT_RESULT =
  'D&D Effect action must have one fixed direct result without lifecycle overrides.'
const TEST_PATHS = 'D&D test action paths must be unique direct outcomes.'

/**
 * The outcome aspect's rule for one entry (ADR 0039 decision 1): it resolves directly, as one
 * outcome or as a sequence or choice its carriers hold, on a result path its test resolves to, with
 * no range or targeting of its own, and outlasts its use only when a plan holds its lifetime. Each
 * part it breaks names its own reason, so a refusal says which rule it rests on.
 */
function outcomeRefusal(
  entry: Dnd5eOutcomeEntry,
  paths: readonly string[],
  carriers: Dnd5eOutcomeCarriers
): string | null {
  if (entry.groupKind === 'SEQUENTIAL' && !carriers.sequence)
    return 'Its sequence has no plan that holds its later outcomes.'
  if (entry.groupKind === 'CHOICE' && !carriers.choice)
    return 'Its choice has no plan that holds its options.'
  if (!paths.includes(entry.pathCode)) return 'Its path is not one its test resolves to.'
  if (entry.rangeOverride || entry.targetingOverride)
    return 'Its result names a range or targeting of its own.'
  if ((hasLifecycleOverride(entry) || entry.maintenanceDefinitionId) && !carriers.lifetime(entry))
    return 'Its duration, lifecycle or maintenance has no plan that holds it.'
  return null
}

function composedOutcome(
  head: string,
  entry: CompiledEntry,
  paths: readonly string[],
  carriers: Dnd5eOutcomeCarriers
): Dnd5eOutcomeEntry {
  if (entry.resolutionKind !== 'DIRECT')
    unsupported(`${head} Its result is rolled on a table, not applied.`)
  const refusal = outcomeRefusal(entry, paths, carriers)
  if (refusal !== null) unsupported(`${head} ${refusal}`)
  return entry
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
  if (!entry) unsupported(`${DIRECT_RESULT} It has no result.`)
  if (entries.length !== (input.repeatsSave ? 2 : 1))
    unsupported(
      input.repeatsSave
        ? `${DIRECT_RESULT} Its repeated save must follow its one result.`
        : `${DIRECT_RESULT} It applies more than one result.`
    )
  return composedOutcome(DIRECT_RESULT, entry, DND5E_TEST_RESULT_PATHS[input.test], input.carriers)
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
      composedOutcome(TEST_PATHS, entry, DND5E_TEST_RESULT_PATHS[input.test], input.carriers)
    )
}
