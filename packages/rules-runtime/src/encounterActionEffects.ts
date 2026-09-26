import { prepareEncounterActionEffectPlans } from './encounterActionEffectPlans.js'
import { toCharacterInitiativeActorFacts } from './character/characterInitiativeFacts.js'
import { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

type CharacterActionMovementFacts = CharacterMovementFacts & {
  sheetState: Pick<CharacterSheetState, 'resourceUsage'>
}
type PreparedMechanics<TCharacterFacts extends CharacterActionMovementFacts> = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<TCharacterFacts>>
>
type CompleteExecution = Extract<
  Awaited<ReturnType<typeof advanceNativeActionGraphs>>,
  { kind: 'COMPLETE' }
>

function encounterActiveEffectPlan<TCharacterFacts extends CharacterActionMovementFacts>(
  prepared: PreparedMechanics<TCharacterFacts>,
  execution: CompleteExecution
) {
  if (prepared.source.kind === 'CHARACTER_ACTION')
    return prepared.source.entry.schemaVersion === 1
      ? null
      : (prepared.source.entry.compilation.activeEffectPlan ?? null)
  const plans =
    prepared.adapter.activeEffectPlans?.({
      action: prepared.source.capability,
      published: execution.published
    }) ?? []
  if (plans.length > 1) throw new Error('Encounter action selected multiple active-effect plans.')
  return plans[0] ?? null
}

function effectiveSize(target: MovementTarget<CharacterActionMovementFacts>): string | null {
  if (target.actor.kind !== 'CHARACTER') {
    const snapshot = target.actor.snapshot
    const payload =
      snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot.payload : null
    return payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      typeof payload.size === 'string'
      ? payload.size
      : null
  }
  const facts = target.characterFacts
  return facts
    ? toCharacterInitiativeActorFacts({
        snapshot: facts.ruleEvaluation.snapshot,
        registry: facts.ruleEvaluation.registry,
        rulePolicyOutput: facts.ruleEvaluation.output
      }).effectiveSize
    : null
}

export function prepareNativeActionEffectsPlan<
  TCharacterFacts extends CharacterActionMovementFacts
>(input: {
  prepared: PreparedMechanics<TCharacterFacts>
  execution: CompleteExecution
  occurrenceId: string
  commandId: string
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}) {
  const { prepared, execution } = input
  const plan = encounterActiveEffectPlan(prepared, execution)
  const target = prepared.movementTargets.get(prepared.target.id)
  if (!target || checksumCanonicalJson(target.actor) !== checksumCanonicalJson(prepared.target))
    throw new Error('Encounter action effect target is stale.')
  const effects = prepareEncounterActionEffectPlans({
    encounterId: prepared.state.id,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    sourceActorId: prepared.actor.id,
    target: {
      actorId: prepared.target.id,
      conditionIds: target.characterFacts
        ? (target.characterFacts.character.state.conditions ?? []).map(
            (condition) => condition.conditionTypeId
          )
        : target.state.conditions,
      effectiveSize: effectiveSize(target),
      lifetimeScope: prepared.target.kind === 'CHARACTER' ? 'OWNER' : 'ENCOUNTER',
      activeEffects: target.activeEffects
    },
    activeEffectsByActorId: input.activeEffectsByActorId,
    activeEffectPlan: plan,
    published: execution.published,
    execution: execution.execution,
    d20: execution.d20,
    applications: execution.applications
  })
  const relationship =
    effects.recurringEffect?.definition.schemaVersion === 2 &&
    effects.recurringEffect.definition.stateContributions.some(
      (contribution) => contribution.kind === 'ACTOR_RELATIONSHIP'
    )
  const appliedCondition = execution.applications.some(
    (application) =>
      application.kind === 'CONDITION_APPLY' &&
      application.targetActorId === prepared.target.id &&
      (!plan?.conditionContribution ||
        application.conditionId === plan.conditionContribution.conditionId)
  )
  const appliedRecurringOutcome =
    !plan?.conditionContribution &&
    execution.applications.some(
      (application) =>
        application.targetActorId === prepared.target.id &&
        application.sourceNodeId === plan?.frozenGraphNodeId &&
        (application.kind === 'HEAL' ||
          application.kind === 'DAMAGE' ||
          application.kind === 'TEMPORARY_HIT_POINTS')
    )
  const recurringEffect =
    relationship || appliedCondition || appliedRecurringOutcome ? effects.recurringEffect : null
  return {
    ...effects,
    recurringEffect,
    maintenance: recurringEffect ? (plan?.maintenance ?? null) : null
  }
}
