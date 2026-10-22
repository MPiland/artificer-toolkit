import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterBasicActionCommitInputSchema,
  type LiveSessionEncounterBasicActionCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  checkActionApplicationOutputDtoSchema,
  encounterCheckActionContextDtoSchema,
  type CheckActionSourceDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'
import { nativeSourceFeatureResourceReceipt } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import type { NativeEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { withFeatureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  overridesActionEconomy,
  TARGET_PRECONDITION_WARNING_CODES
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  encounterBasicActionCheckPendingSnapshot,
  evaluateEncounterBasicActionCheck,
  freezeEncounterActorCheck,
  startEncounterBasicActionCheck,
  storedCheckResult
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { encounterHeldCheckDice } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import { actionEndedEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'
import { planNativeTargetOutcome, type NativeTargetOutcomeSource } from './nativeTargetOutcome.js'

type CheckTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/** What makes a check action: a basic action, or a Creature feature authored with the check (D173). */
export type NativeCheckActionSource = Extract<
  NativeEncounterActionSource,
  { kind: 'BASIC_ACTION' | 'CREATURE' }
>

export type NativeLiveCheckActionInput = {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  command: ResolveEncounterActionInputDto
  fingerprint: string
  source: NativeCheckActionSource
  /** The action's prepared mechanics, whose plan a check's success outcome runs on. */
  prepared: NativeTargetOutcomeSource['prepared']
  state: {
    id: string
    version: number
    gameSystemId: string
    currentActorId: string | null
    optionalCombatSnapshotChecksum: string | null
  }
  system: SystemAuthoredDto
  actors: readonly EncounterRunActorState[]
  actor: CheckTarget
  /** The effects the acting actor holds before the action; taking it ends those that end with an action. */
  actorEffects: readonly ActiveRuleEffectRecord[]
  target: CheckTarget
  overrides: readonly EncounterRuleWarningDto[]
  actionEconomy: LiveSessionEncounterBasicActionCommitInput['actionEconomy']
  /** The roller's die source when their preference rolls for them; null waits on their d20. */
  autoRoll: ((maximum: number) => number) | null
  runtime: RulesRuntimeService
  revisions: LiveSessionRulesRevisions
}

/** The one authored check of a CHECK action: the skill (else ability) it rolls and its DC. */
export function authoredCheckOf(capability: NativeCheckActionSource['capability']) {
  const invocation = capability.compiledEffect.invocation
  // The compiler admits exactly one check; its types cannot say so.
  if (invocation.triggerCode !== 'CHECK')
    throw new EncounterValidationError('The selected action makes no check.')
  const { skillIds, abilityDefinitionIds } = invocation.check.checks
  const skillId = skillIds[0]
  const checkDefinitionId = skillId ?? abilityDefinitionIds[0]
  if (!checkDefinitionId) throw new EncounterValidationError('A check action lists one check.')
  return {
    checkKind: skillId ? ('SKILL' as const) : ('ABILITY' as const),
    checkDefinitionId,
    dc: invocation.check.dc
  }
}

/** A check only a basic action makes (concealment) reads its catalogue entry. */
export function basicCheckCapability(source: NativeCheckActionSource) {
  if (source.kind !== 'BASIC_ACTION')
    throw new EncounterValidationError('Only a basic action makes this check.')
  return source.capability
}

/** The check action's source as its context and output record it. */
function checkActionSourceOf(source: NativeCheckActionSource): CheckActionSourceDto {
  return source.kind === 'BASIC_ACTION'
    ? {
        kind: 'BASIC_ACTION',
        definition: {
          id: source.capability.definitionId,
          version: source.capability.definitionVersion,
          checksum: source.capability.definitionChecksum
        }
      }
    : {
        kind: 'CREATURE_FEATURE',
        ownerFeatureId: source.capability.ownerFeatureId,
        effectId: source.capability.effectId,
        compiledEffectChecksum: source.capability.compiledEffectChecksum
      }
}

/**
 * The commit input of a CHECK action: the actor spends the action's allowance, and `check` is the
 * pending or settled check the caller planned. Convex records the plan; it evaluates none of it.
 */
export function nativeLiveCheckCommitInput(
  input: NativeLiveCheckActionInput,
  planned: {
    check: LiveSessionEncounterBasicActionCommitInput['check']
    consumedGrants: LiveSessionEncounterBasicActionCommitInput['consumedGrants']
    /** The target after a won check's outcome changed it in the room. */
    settledTarget?: EncounterRunActorState
  }
) {
  const { command, state, actor } = input
  // A Creature feature's check spends its charges with the action (D173).
  const featureResourceConsumption = nativeSourceFeatureResourceReceipt(input.prepared)
  const economySpent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor: actor.actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.overrides)
      })
    : actor.actor
  const settled = featureResourceConsumption
    ? encounterRunActorStateSchema.parse({
        ...economySpent,
        resources: withFeatureChargeUsed(
          economySpent,
          featureResourceConsumption.ownerFeatureId,
          featureResourceConsumption.afterUsed
        )
      })
    : economySpent
  // An action ends the effects that last until its holder takes one (Hide in Plain Sight). A check
  // that rolls nothing is no action taken, and the conditions an ending effect alone held are
  // released in the holder's own batch, which a check action does not plan.
  const { consumedGrants: ended, sourceReleases } = actionEndedEffects({
    holderActorId: settled.id,
    held: planned.check ? input.actorEffects : [],
    makesAttackRoll: false,
    againstEnemy: false
  })
  if (sourceReleases.length)
    throw new EncounterValidationError('A check action cannot end an effect that owns a condition.')
  const facts = buildEncounterActorRuleFacts({ actors: input.actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: input.actors.map((entry) =>
      entry.id === settled.id
        ? settled
        : entry.id === planned.settledTarget?.id
          ? planned.settledTarget
          : entry
    )
  })
  return liveSessionEncounterBasicActionCommitInputSchema.parse({
    ...input.scope,
    command,
    revisions: input.revisions,
    occurredAt: new Date().toISOString(),
    source: checkActionSourceOf(input.source),
    featureResourceConsumption,
    actionEconomy: input.actionEconomy,
    ruleOverrides: input.overrides,
    consumedGrants: [
      ...planned.consumedGrants,
      ...ended.filter(({ id }) => !planned.consumedGrants.some((grant) => grant.id === id))
    ],
    check: planned.check,
    rules: reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
      nextFacts,
      {
        output: reconcileEncounterActorRuleOutput(
          evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
          facts
        )
      }
    )
  })
}

/**
 * Plans a fixed-DC CHECK action whose success runs its authored outcome on its target (D173): the
 * actor's frozen check rolls against the authored DC, and a success runs the action's sealed
 * ON_CHECK_SUCCESS graph, the same outcome a won contest runs. The check pends on the roller's d20
 * unless their preference rolls for them and they hold no after-roll dice; its answer runs the
 * outcome then (`planNativeLiveCheckActionResponse`). An action that proceeds over its target's
 * unmet outcome precondition (First Aid on a creature that is not dying) rolls nothing (D173 Q1).
 */
export async function planNativeLiveCheckAction(input: NativeLiveCheckActionInput) {
  const { source, command, state, actor, target, prepared } = input
  const { checkKind, checkDefinitionId, dc } = authoredCheckOf(source.capability)
  if (dc.kind !== 'FIXED' || prepared.plan.kind !== 'TEST_OUTCOME')
    throw new EncounterValidationError('The selected action makes no fixed-DC check.')
  const autoRoll =
    encounterHeldCheckDice(input.system, input.actorEffects, checkDefinitionId).length > 0
      ? null
      : input.autoRoll
  const { d20, consumedGrants } = freezeEncounterActorCheck({
    gameSystemId: state.gameSystemId,
    system: input.system,
    check: { checkKind, checkDefinitionId },
    actor
  })
  // An actor with no check is refused first, whatever the target.
  if (input.overrides.some(({ code }) => TARGET_PRECONDITION_WARNING_CODES.has(code)))
    return {
      kind: 'CHECK' as const,
      input: nativeLiveCheckCommitInput(input, { check: null, consumedGrants: [] })
    }
  const context = encounterCheckActionContextDtoSchema.parse({
    kind: 'ENCOUNTER_CHECK_ACTION',
    schemaVersion: 1,
    commandId: command.commandId,
    commandFingerprint: input.fingerprint,
    source: checkActionSourceOf(source),
    actionLabel: source.capability.label,
    actorId: actor.actor.id,
    targetActorId: target.actor.id,
    check: {
      checkDefinitionId,
      dc: dc.value,
      label: encounterBasicActionCheckLabel(input.system, checkDefinitionId)
    },
    d20,
    consumedGrants
  })
  const occurrenceId = crypto.randomUUID()
  const continuation = await startEncounterBasicActionCheck({
    runtime: input.runtime,
    gameSystemId: state.gameSystemId,
    occurrenceId,
    addedDice: d20.addedDice,
    published: prepared.plan.test.published
  })
  if (!autoRoll)
    return {
      kind: 'CHECK' as const,
      input: nativeLiveCheckCommitInput(input, {
        check: {
          kind: 'PENDING',
          snapshot: encounterBasicActionCheckPendingSnapshot({
            continuation,
            // The answer re-prepares the outcome from the root command, never from these facts.
            context: { ...context, commandJson: JSON.stringify(command), phase: { kind: 'CHECK' } },
            optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
          })
        },
        consumedGrants
      })
    }
  const evaluated = await evaluateEncounterBasicActionCheck({
    gameSystemId: state.gameSystemId,
    runtime: input.runtime,
    context,
    continuation,
    answer: { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
    rollD20: () => autoRoll(20) + 1,
    random: autoRoll,
    expectedOccurrenceId: occurrenceId
  })
  const outcome = evaluated.reachesDc
    ? await planNativeTargetOutcome({
        prepared,
        occurrenceId,
        commandId: command.commandId,
        occurredAt: new Date().toISOString(),
        userId: input.scope.expectedUserId,
        execution: evaluated.execution,
        testRollMode: evaluated.d20.rollMode,
        runtime: input.runtime,
        autoRoll: true,
        answered: null,
        random: autoRoll
      })
    : null
  if (outcome?.kind === 'PENDING') throw new Error('An auto-rolled check outcome cannot pend.')
  const applicationOutputs = checkActionApplicationOutputDtoSchema.parse({
    kind: 'CHECK_ACTION',
    schemaVersion: 1,
    occurrenceId,
    commandId: command.commandId,
    source: context.source,
    actorId: context.actorId,
    targetActorId: context.targetActorId,
    check: { checkDefinitionId, dc: dc.value },
    d20: evaluated.d20,
    outcome: evaluated.reachesDc ? 'SUCCESS' : 'FAILURE',
    stateTransition: outcome?.stateTransition ?? { kind: 'NONE' }
  })
  const execution = storedCheckResult({
    evaluated,
    continuation,
    occurrenceVersion: 0,
    initialFactsChecksum: checksumRuleDocument(continuation.facts),
    applicationOutputs
  })
  return {
    kind: 'CHECK' as const,
    input: nativeLiveCheckCommitInput(input, {
      check: {
        kind: 'SETTLED',
        settlement: {
          context,
          execution,
          appRollId: null,
          forcedMovements: outcome?.forcedMovements ?? []
        }
      },
      consumedGrants,
      ...(outcome && { settledTarget: outcome.actor })
    })
  }
}
