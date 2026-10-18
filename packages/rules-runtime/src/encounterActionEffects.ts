import { prepareEncounterActionEffectPlans } from './encounterActionEffectPlans.js'
import type { CharacterRuleActionActiveEffectPlan } from './characterRuleActionSystemAdapter.js'
import { toCharacterInitiativeActorFacts } from './character/characterInitiativeFacts.js'
import { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import { encounterActionSourceLabel } from './encounterActionSources.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

type CharacterActionMovementFacts = CharacterMovementFacts & {
  sheetState: Pick<CharacterSheetState, 'resourceUsage' | 'itemUsage'>
}
type PreparedMechanics<TCharacterFacts extends CharacterActionMovementFacts> = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<TCharacterFacts>>
>
type CompleteExecution = Extract<
  Awaited<ReturnType<typeof advanceNativeActionGraphs>>,
  { kind: 'COMPLETE' }
>

/** The active-effect plan an action's capability carries, selected by the definition that ran. */
export function encounterActiveEffectPlan<TCharacterFacts extends CharacterActionMovementFacts>(
  prepared: PreparedMechanics<TCharacterFacts>,
  published: CompleteExecution['published']
) {
  if (prepared.source.kind === 'CHARACTER_ACTION')
    return prepared.source.entry.compilation.activeEffectPlan
  const plans =
    prepared.adapter.activeEffectPlans?.({
      action: prepared.source.capability,
      published
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
  concealment?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['concealment']
  link?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['link']
  form?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['form']
  /** What triggered a reaction, which its effect may bind. */
  trigger?: { damageTypeIds: readonly string[] }
}) {
  const { prepared, execution } = input
  const plan: CharacterRuleActionActiveEffectPlan | null = encounterActiveEffectPlan(
    prepared,
    execution.published
  )
  const target = prepared.movementTargets.get(prepared.target.id)
  if (!target || checksumCanonicalJson(target.actor) !== checksumCanonicalJson(prepared.target))
    throw new Error('Encounter action effect target is stale.')
  const effects = prepareEncounterActionEffectPlans({
    encounterId: prepared.state.id,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    sourceActorId: prepared.actor.id,
    sourceLabel: encounterActionSourceLabel(prepared.source),
    sourceHidden: !prepared.actor.public,
    currentActorId: prepared.state.currentActorId,
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
    concealment: input.concealment,
    link: input.link,
    form: input.form,
    published: execution.published,
    execution: execution.execution,
    d20: execution.d20,
    applications: execution.applications,
    trigger: input.trigger
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
      (!plan?.conditionContributions?.length ||
        plan.conditionContributions.some(
          ({ conditionId }) => application.conditionId === conditionId
        ))
  )
  const appliedRecurringOutcome =
    !plan?.conditionContributions?.length &&
    execution.applications.some(
      (application) =>
        application.targetActorId === prepared.target.id &&
        application.sourceNodeId === plan?.frozenGraphNodeId &&
        (application.kind === 'HEAL' ||
          application.kind === 'DAMAGE' ||
          application.kind === 'TEMPORARY_HIT_POINTS')
    )
  // A grant, concealment, link or form applies no stored state, so its effect exists exactly when
  // its plan does (a concealment plan yields none when its check beats no observer).
  const grant = Boolean(
    plan?.modifierGrantContribution ||
    plan?.concealmentContribution ||
    plan?.actorLinkContribution ||
    plan?.creatureFormContribution
  )
  const recurringEffect =
    relationship || grant || appliedCondition || appliedRecurringOutcome
      ? effects.recurringEffect
      : null
  // A rider's effect exists exactly when the save failed by its margin and applied its conditions.
  const riderEffect = execution.applications.some(
    (application) =>
      application.kind === 'CONDITION_APPLY' &&
      application.targetActorId === prepared.target.id &&
      plan?.marginRider?.conditionContributions.some(
        ({ conditionId }) => application.conditionId === conditionId
      )
  )
    ? effects.riderEffect
    : null
  return {
    ...effects,
    recurringEffect,
    riderEffect,
    maintenance: recurringEffect ? (plan?.maintenance ?? null) : null
  }
}
