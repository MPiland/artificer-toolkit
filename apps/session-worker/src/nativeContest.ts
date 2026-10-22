import {
  actionTargetActorId,
  castChoiceOptionId,
  type EscapeRelationshipInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  liveSessionEncounterContestCommitInputSchema,
  liveSessionEncounterContestPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterContest'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import type { EncounterActionEconomyConsumption } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { encounterAttackD20Belief } from '@artificer-toolkit/rules-runtime/encounterAttackBelief'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  prepareEncounterBasicActionContest,
  prepareEncounterEscapeContest
} from '@artificer-toolkit/rules-runtime/encounterBasicActionContest'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  contestApplicationOutputs,
  contestSourceWins,
  planEncounterDisarmSuccess,
  prepareEncounterDisarmContest,
  readEncounterDisarmSelection,
  requireEncounterDisarmDefinition
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import { planNativeEncounterAreaSourceSpend } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  actionEndedEffects,
  actsAgainstEnemy
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import {
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds,
  findEncounterHolderContestEscape
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import {
  withEncounterAppRoll,
  type EncounterEvidenceAnswer
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { requireActionContinuation } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import { resumeEncounterD20 } from '@artificer-toolkit/rules-runtime/encounterD20AddedDice'
import { actionResponse } from '@artificer-toolkit/rules-runtime/encounterD20Settlement'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { resolveEncounterActionPhaseExecution } from '@artificer-toolkit/rules-runtime/encounterActionPhaseExecution'
import type { CharacterRuleActionApplication } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import {
  contestDefenderPicksCheck,
  contestDefenderPolicy,
  executeEncounterOptionalContestAction
} from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { sightGovernedStageD20 } from '@artificer-toolkit/rules-runtime/encounterSightGovernedD20'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { requireEncounterD20Evidence } from './nativeD20Evidence.js'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import {
  readNativeLiveAttackPerception,
  readNativeLiveSourcesSeen
} from './nativeAttackPerception.js'
import {
  captureActionEconomyDefinitions,
  evaluateNativeLiveActionEconomy
} from './nativeEncounterActionEconomy.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects,
  readNativeLiveSpellPins
} from './nativeEncounterTargets.js'
import { createNativeActiveEffect, nativeEffectOwner } from './nativeEncounterSettlement.js'
import { interpretForcedMovements } from './nativeEncounterActionInputs.js'
import { spendNativeHolderActivation } from './nativeHolderActivation.js'

type ContestPreparation = {
  contest: ReturnType<typeof prepareEncounterDisarmContest>['contest']
  published: ReturnType<typeof prepareEncounterBasicActionContest>['published']
  currentnessChecksum: string
}
type ContestActors = Awaited<ReturnType<typeof readNativeLiveActorsAndEffects>>
type PreparedContest = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<PreparedLiveCharacterSheet>>
>
type ContestReady = Omit<
  NonNullable<Extract<LiveSessionEncounterRulesResponse, { kind: 'CONTEST' }>['ready']>,
  'command'
>
type ContestPendingContext = Extract<
  NonNullable<ContestReady['snapshot']>['applicationContext'],
  { kind: 'ENCOUNTER_ACTION' }
> & { contest: ContestPreparation['contest'] }
/**
 * What a won contest changes: an action's outcome (the Disarmed item or the hold) from its prepared
 * mechanics, or a contested escape that ends the held source's `activeEffectId`.
 */
type ContestSettlement =
  | { kind: 'ACTION'; prepared: PreparedContest }
  | { kind: 'ESCAPE'; holderEffects: readonly ActiveRuleEffectRecord[]; activeEffectId: string }
type ContestRolls = Extract<
  Awaited<ReturnType<typeof executeEncounterOptionalContestAction>>,
  { kind: 'COMPLETE' }
>

/** The contest with one participant's settled faces recorded as its roll evidence. */
function withRollEvidence(
  contest: ContestPreparation['contest'],
  participant: 'INITIATOR' | 'DEFENDER',
  requestId: string,
  rawFaces: readonly number[],
  defenderCheckDefinitionId: string
) {
  return {
    ...contest,
    rollEvidence:
      participant === 'INITIATOR'
        ? { ...contest.rollEvidence, initiator: { requestId, rawFaces: [...rawFaces] } }
        : {
            ...contest.rollEvidence,
            defender: {
              requestId,
              rawFaces: [...rawFaces],
              checkDefinitionId: defenderCheckDefinitionId
            }
          }
  }
}

/** The pending contest a stored snapshot seals; null before the first d20. */
function readContestPendingContext(
  snapshot: ContestReady['snapshot']
): ContestPendingContext | null {
  const context = snapshot?.snapshotKind === 'KERNEL_EVIDENCE' ? snapshot.applicationContext : null
  if (snapshot && (context?.kind !== 'ENCOUNTER_ACTION' || !context.contest))
    throw new Error('The pending contest is unavailable.')
  return context?.kind === 'ENCOUNTER_ACTION' && context.contest
    ? { ...context, contest: context.contest }
    : null
}

type ContestWin = {
  prepared: PreparedContest
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
}

/** The one mechanics batch a won basic action contest applies to its target (D152). */
function planNativeContestTargetMechanics(
  input: ContestWin,
  applications: readonly CharacterRuleActionApplication[]
) {
  const { prepared, occurrenceId, commandId, occurredAt } = input
  const holder = prepared.movementTargets.get(prepared.target.id)
  if (!holder) throw new Error('The contest target is unavailable.')
  return planEncounterMechanicsBatch({
    batch: {
      encounterId: prepared.state.id,
      targetActorId: holder.actor.id,
      expectedEncounterVersion: prepared.state.version,
      occurrenceId,
      sourceCommandId: commandId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId,
        sourceCommandId: commandId,
        phase: 'DIRECT_ACTION_OUTCOME',
        ordinal: 0,
        targetCharacterId: holder.characterFacts?.active.id ?? holder.actor.id
      }),
      occurredAt,
      applications: [...applications],
      expectedCharacterStreamVersion: holder.characterFacts?.active.play.streamVersion ?? null,
      effectiveMaximumHitPoints: holder.effectiveMaximumHitPoints,
      damageInterceptions: holder.damageInterceptions,
      effectiveScalarValues: holder.effectiveScalarValues,
      forceVersionAdvance: false
    },
    actor: holder.actor,
    userId: input.userId,
    ...(holder.characterFacts ? { characterFacts: holder.characterFacts } : {})
  })
}

/**
 * What a won basic action contest whose win is its picked outcome (Shove, D105) settles on its
 * target: the sealed ON_CHECK_SUCCESS graph run on the prepared facts, its dice rolled by the
 * initiator in the action roll window, every application in one mechanics batch here and in Convex,
 * and its forced movements landed on the Scene in the commit (D157, D173). An initiator who rolls
 * their own dice leaves the outcome PENDING on its paused continuation.
 */
async function planNativeContestOutcome(
  input: ContestWin & {
    execution: ContestRolls['execution']
    runtime: RulesRuntimeService
    autoRoll: boolean
    /** The initiator's answer to the outcome's paused dice request, once given. */
    answered: {
      continuation: ServerRuleExecutionContinuationDto
      answer: EncounterEvidenceAnswer
    } | null
    random(maximum: number): number
  }
) {
  const { prepared, occurrenceId, runtime } = input
  const { adapter, plan, binding } = prepared
  if (plan.kind !== 'TEST_OUTCOME') throw new Error('The contest win outcome is unavailable.')
  const outcome = resolveEncounterActionPhaseExecution({
    plan,
    phase: 'TEST',
    execution: input.execution,
    adapter,
    facts: adapter.bindFacts({ ...binding, published: plan.test.published }).facts,
    testRollMode: 'NORMAL',
    effectivePath: 'ON_CHECK_SUCCESS'
  })
  if (outcome.kind !== 'OUTCOME') throw new Error('The contest win outcome is unavailable.')
  const { published } = outcome.outcome
  const { facts } = adapter.bindFacts({ ...binding, published })
  const answer = (
    continuation: ServerRuleExecutionContinuationDto,
    resolution: EncounterEvidenceAnswer
  ) => {
    const response = actionResponse({
      gameSystemId: published.gameSystemId,
      continuation,
      policy: null,
      resolution,
      random: input.random
    })
    return resumeEncounterD20({
      continuation,
      natural: response.value,
      addedDice: response.addedDice,
      resume: (step) => runtime.resume(step)
    })
  }
  if (input.answered)
    requireActionContinuation({
      continuation: input.answered.continuation,
      occurrenceId,
      published,
      facts
    })
  let execution = input.answered
    ? await answer(input.answered.continuation, input.answered.answer)
    : await runtime.executeResolved({
        command: { definitionId: published.id, occurrenceId, facts },
        published
      })
  while (execution.status === 'PAUSED') {
    if (!input.autoRoll) return { kind: 'PENDING' as const, continuation: execution.continuation }
    execution = await answer(execution.continuation, {
      kind: 'AUTO_ROLL',
      requestId: execution.continuation.request.requestId
    })
  }
  if (execution.status !== 'COMPLETE') throw new Error('The contest win outcome did not settle.')
  const applications = adapter.interpret({
    execution,
    occurrenceId,
    published,
    targetActorId: binding.targetActorId,
    currentHitPoints: binding.currentHitPoints,
    temporaryHitPoints: binding.temporaryHitPoints,
    maximumHitPoints: binding.maximumHitPoints,
    defenses: binding.defenses,
    conditionImmunityIds: binding.conditionImmunityIds
  })
  const forcedMovements = interpretForcedMovements(prepared, {
    execution,
    occurrenceId,
    published,
    targetActorId: prepared.target.id
  })
  const mechanics = applications.length
    ? planNativeContestTargetMechanics(input, applications)
    : null
  return {
    kind: 'SETTLED' as const,
    actor: mechanics?.updatedActor ?? prepared.target,
    forcedMovements,
    stateTransition: {
      kind: 'TARGET_OUTCOME' as const,
      mechanics: mechanics && {
        targetTransition: mechanics.targetTransition,
        applications: mechanics.receiptApplications
      },
      forcedMovements: forcedMovements.map(({ direction, feet, upTo }) => ({
        direction,
        feet,
        upTo
      }))
    }
  }
}

/**
 * The hold a won basic action contest (Grapple) creates on its target: the action's relationship
 * effect, from the initiator's winning check against the defender's total, and the conditions it
 * newly applies (D152). Convex re-derives both from the stored effect at settlement.
 */
function planNativeContestHold(
  input: ContestWin & {
    published: ContestPreparation['published']
    rolls: ContestRolls
    initiatorRequestId: string
    activeEffectsByActorId: ContestActors['activeEffectsByActorId']
  }
) {
  const { prepared, rolls, occurrenceId, commandId, occurredAt } = input
  const { initiator, defender } = rolls
  const effects = prepareNativeActionEffectsPlan({
    prepared,
    execution: {
      published: input.published,
      execution: rolls.execution,
      d20: {
        requestId: input.initiatorRequestId,
        rollMode: initiator.rollMode,
        keep: initiator.keep,
        derivedRollMode: initiator.rollMode,
        rawFaces: [...initiator.rawFaces],
        selectedNatural: initiator.selectedNatural,
        contributors: [...initiator.contributors],
        contributorChecksum: initiator.contributorChecksum,
        modifier: initiator.modifier,
        total: initiator.total,
        defenseOrDc: defender.total,
        resultPath: 'ON_CHECK_SUCCESS'
      },
      applications: []
    },
    occurrenceId,
    commandId,
    activeEffectsByActorId: input.activeEffectsByActorId
  })
  if (!effects.recurringEffect) throw new Error('The contest hold effect is unavailable.')
  const record = createNativeActiveEffect(effects.recurringEffect, {
    owner: nativeEffectOwner(prepared.target, prepared.state.id),
    currentEffects: [...prepared.targetFacts.activeEffects],
    occurredAt
  })
  const applications = effects.relationshipConditionApplications
  const mechanics = planNativeContestTargetMechanics(input, applications)
  const [createdEffect] = projectNativeActionEffectTransitions({
    state: null,
    recurring: record,
    targetActorId: prepared.target.id
  }).activeEffectTransitions
  return {
    record,
    actor: mechanics.updatedActor,
    stateTransition: {
      kind: 'ACTOR_RELATIONSHIP' as const,
      createdEffect: createdEffect!,
      appliedConditionIds: applications.map(({ conditionId }) => conditionId)
    }
  }
}

/**
 * Plans a contest (Disarm, Grapple), or a participant's d20 for one, in the room: both contest d20s
 * roll here with the room's randomness and each participant's auto-roll preference. Convex stores
 * the paused contest or re-applies the settled changes; it never rolls.
 */
export async function planNativeLiveContest(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
  }
) {
  const request = { kind: 'CONTEST' as const, command }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted contest lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    command.encounterId.toLowerCase() !== initial.encounterId ||
    command.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live contest scope mismatch.')
  const reads = liveEncounterCaptures(initial, executionOptions.captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const ready = admission.ready
  if (!ready) throw new Error('The contest is unavailable.')
  const root = ready.command
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Contest Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const loadTarget = async (entry: (typeof actors)[number]) => {
    const prepared = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor: entry,
      activeEffectsByActorId,
      ...executionOptions
    })
    reads.observe(prepared.revisions)
    return prepared.target
  }
  const priorContext = readContestPendingContext(ready.snapshot)
  if (root.type === 'ESCAPE') {
    // An escape reaches here only to resume its contest; its first plan starts with the escape.
    if (command.type !== 'RESOLVE_RULE_OCCURRENCE') throw new Error('The contest is unavailable.')
    return planNativeLiveEscapeContest({
      scope,
      command,
      root,
      ready,
      priorContext,
      state,
      system,
      actors,
      activeEffectsByActorId,
      loadTarget,
      capture,
      runtime: executionOptions.runtime,
      random: executionOptions.random,
      revisions: reads.revisions
    })
  }
  const targetActorId = actionTargetActorId(root.target)
  const intent = root.optionalCombatIntent
  const actor = actors.find((entry) => entry.id === root.actorId)
  const target = actors.find((entry) => entry.id === targetActorId)
  if (!actor || !target) throw new Error('Contest actors are unavailable.')
  const movementTargets = new Map(
    await Promise.all(
      [actor, target].map(async (entry) => [entry.id, await loadTarget(entry)] as const)
    )
  )
  const definition = intent
    ? requireEncounterDisarmDefinition({
        state,
        actors,
        actor,
        target,
        command: {
          ...root,
          targetActorId,
          definitionId: intent.definitionId
        }
      })
    : null
  const scene = root.sceneContext
    ? (
        await capture({
          kind: 'ACTION_SCENE',
          command: {
            actorId: root.actorId,
            targetActorId,
            sceneContext: root.sceneContext
          }
        })
      ).context
    : null
  const sceneContext = scene
    ? {
        sceneId: scene.sceneId,
        sceneVersion: scene.sceneVersion,
        sourceToken: scene.sourceToken,
        targetToken: scene.targetToken,
        grid: resolveEncounterSceneGrid({
          encounter: state,
          sceneGrid: scene.sceneGrid
        })
      }
    : null
  const definitions = captureActionEconomyDefinitions(capture)
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor,
    target,
    actors,
    actionId: root.actionId,
    // A resumed contest runs as the outcome its root picked (Shove, D105).
    choiceOptionId: castChoiceOptionId(root.target),
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: false,
    movementTargets,
    sceneContext,
    loadAttackPerception: ({ sourceFacts, targetFacts, roller }) =>
      readNativeLiveAttackPerception({
        state,
        system,
        attacker: sourceFacts,
        target: targetFacts,
        roller,
        sceneContext,
        capture
      }),
    loadSourcesSeen: ({ holder, sourceActorIds }) =>
      readNativeLiveSourcesSeen({
        state,
        system,
        holder,
        sourceActorIds,
        actors,
        loadTarget: async (entry) => movementTargets.get(entry.id) ?? loadTarget(entry),
        sceneContext,
        capture
      }),
    loadSource: async (input) =>
      resolveEncounterActionSource({
        ...input,
        system,
        spells: await readNativeLiveSpellPins(capture),
        basicActions: await readEncounterBasicActionEntries({
          actorId: input.actor.id,
          actionId: input.actionId,
          gameSystemId: input.gameSystemId,
          definitions
        })
      }),
    loadRelationshipFacts: async (input) =>
      lockedRelationshipActionFacts({
        actionEffectId: input.actionEffectId,
        sourceActorId: input.sourceActorId,
        targetActorId: input.targetActorId,
        targets: { activeEffectsByActorId }
      })
  })
  const priorContest = priorContext ? { priorContest: priorContext.contest } : {}
  const contestInput = { state, actor, target, command: root, prepared, sceneContext, system }
  let preparation: ContestPreparation
  let actionEconomy: EncounterActionEconomyConsumption | null
  let contestAttackAction: EncounterAttackActionTransitionDto | null = null
  if (definition) {
    const selection = readEncounterDisarmSelection({
      actor,
      target,
      actionId: root.actionId,
      definition,
      prepared,
      sceneContext,
      rejectTarget: () => {
        throw new LiveSessionDomainRejectionError(422, {
          code: 'DOMAIN_REJECTED',
          reason: 'TARGET_UNAVAILABLE',
          message: 'Optional combat target is unavailable.'
        })
      }
    })
    actionEconomy = await prepareEncounterActionEconomy({
      actor,
      state,
      activation: { code: 'ACTION', amount: 1 },
      target: prepared.sourceFacts,
      loadTarget: async () => movementTargets.get(actor.id),
      definitions
    })
    const disarm = prepareEncounterDisarmContest({
      ...contestInput,
      definition,
      selection,
      actionEconomy,
      ...priorContest
    })
    preparation = { ...disarm, published: disarm.graph.published }
  } else {
    // A basic action contest (Grapple) spends the allowance its own activation names.
    const { economy, attackAction } = await evaluateNativeLiveActionEconomy({
      prepared,
      state,
      actionId: root.actionId,
      sourceTarget: movementTargets.get(actor.id),
      targetIds: [target.id],
      capture
    })
    actionEconomy = economy?.consumption ?? null
    contestAttackAction = attackAction
    preparation = prepareEncounterBasicActionContest({
      ...contestInput,
      actionEconomy,
      ...priorContest
    })
  }
  return planNativeLiveContestRolls({
    scope,
    command,
    root,
    ready,
    priorContext,
    state,
    actors,
    actor,
    target,
    settlement: { kind: 'ACTION', prepared },
    actorRules: prepared.actorRules,
    sceneContext,
    activeEffectsByActorId,
    preparation,
    actionEconomy,
    attackAction: contestAttackAction,
    runtime: executionOptions.runtime,
    random: executionOptions.random,
    revisions: reads.revisions()
  })
}

/**
 * Plans a held creature's escape its holder contests, or a participant's d20 for one (D152): the
 * escape's activation, then the escaper's chosen check against the holder's sealed checks through
 * the one contest roller. A win ends the holding effect.
 */
export async function planNativeLiveEscapeContest(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  command: EscapeRelationshipInputDto | ResolveRuleOccurrenceInputDto
  root: EscapeRelationshipInputDto
  ready: ContestReady
  priorContext: ContestPendingContext | null
  state: EncounterRunState
  system: Parameters<typeof prepareEncounterEscapeContest>[0]['system']
  actors: ContestActors['actors']
  activeEffectsByActorId: ContestActors['activeEffectsByActorId']
  loadTarget(
    actor: ContestActors['actors'][number]
  ): Promise<Parameters<typeof prepareEncounterEscapeContest>[0]['holder']>
  capture: Parameters<typeof spendNativeHolderActivation>[0]['capture']
  runtime: RulesRuntimeService
  random(maximum: number): number
  revisions(): LiveSessionRulesRevisions
}) {
  const { root, state, actors, activeEffectsByActorId } = input
  const actor = actors.find((entry) => entry.id === root.actorId)
  const heldEffects = activeEffectsByActorId.get(root.actorId) ?? []
  const effect = heldEffects.find((entry) => entry.id === root.activeEffectId)
  const escape = effect ? findEncounterHolderContestEscape(effect) : null
  const holderActor = actors.find((entry) => entry.id === escape?.holderActorId)
  if (!actor || !effect || !escape || !holderActor)
    throw new EncounterValidationError('The creature is not held by an effect its holder contests.')
  const escaper = await input.loadTarget(actor)
  const holder = await input.loadTarget(holderActor)
  const { actionEconomy, warnings } = await spendNativeHolderActivation({
    actor,
    state,
    holder: escaper,
    activation: escape.activation,
    acknowledgedWarnings: root.acknowledgedWarnings,
    capture: input.capture
  })
  // A contest spends its allowance only within its maximum (D152).
  if (overridesActionEconomy(warnings))
    throw new EncounterValidationError('A contested escape cannot go past its action allowance.')
  const preparation = prepareEncounterEscapeContest({
    state,
    escaper,
    holder,
    activeEffectId: effect.id,
    checkDefinitionId: root.checkDefinitionId,
    system: input.system,
    actionEconomy,
    ...(input.priorContext ? { priorContest: input.priorContext.contest } : {})
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  return planNativeLiveContestRolls({
    scope: input.scope,
    command: input.command,
    root,
    ready: input.ready,
    priorContext: input.priorContext,
    state,
    actors,
    actor,
    target: holderActor,
    settlement: { kind: 'ESCAPE', holderEffects: heldEffects, activeEffectId: effect.id },
    actorRules: reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts
    ),
    sceneContext: null,
    activeEffectsByActorId,
    preparation,
    actionEconomy,
    runtime: input.runtime,
    random: input.random,
    revisions: input.revisions()
  })
}

/**
 * Rolls a sealed contest's d20s and plans what settling it changes: the paused contest waiting on
 * a participant, or the settled outcome (the item or the hold), action economy and receipts. The
 * room's ordinary action planner starts a basic action contest through it too.
 */
export async function planNativeLiveContestRolls(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  command:
    | ResolveEncounterActionInputDto
    | EscapeRelationshipInputDto
    | ResolveRuleOccurrenceInputDto
  root: ResolveEncounterActionInputDto | EscapeRelationshipInputDto
  ready: ContestReady
  priorContext: ContestPendingContext | null
  state: EncounterRunState
  actors: ContestActors['actors']
  actor: ContestActors['actors'][number]
  target: ContestActors['actors'][number]
  settlement: ContestSettlement
  /** The actors' current installed rule output, which the settled output reconciles against. */
  actorRules: PreparedContest['actorRules']
  sceneContext: unknown
  activeEffectsByActorId: ContestActors['activeEffectsByActorId']
  preparation: ContestPreparation
  actionEconomy: EncounterActionEconomyConsumption | null
  /** The Attack action a contest that replaces one attack fills; null for any other contest. */
  attackAction?: EncounterAttackActionTransitionDto | null
  runtime: RulesRuntimeService
  random(maximum: number): number
  revisions: LiveSessionRulesRevisions
}) {
  const { scope, command, root, ready, priorContext, state, actors, actor, target, settlement } =
    input
  const prepared = settlement.kind === 'ACTION' ? settlement.prepared : null
  const { sceneContext, activeEffectsByActorId, preparation, actionEconomy } = input
  if (priorContext && preparation.currentnessChecksum !== priorContext.currentnessChecksum)
    throw new Error('The pending contest source or target changed.')
  let contest = preparation.contest
  // Only an optional combat initiator makes an attack roll whose mode sight governs.
  const attackSight =
    contest.origin.kind === 'OPTIONAL_COMBAT' ? (prepared?.attackSight ?? null) : null
  const pending = ready.snapshot
  const response = command.type === 'RESOLVE_RULE_OCCURRENCE' ? command : null
  const answered =
    response && pending && priorContext
      ? (() => {
          const {
            snapshotKind: _snapshotKind,
            applicationContext: _applicationContext,
            optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
            phaseReceipts: _phaseReceipts,
            deferredCleaving: _deferredCleaving,
            ...continuation
          } = pending
          // An app roll settles with the faces Convex recorded for it, never client-supplied values.
          return { continuation, answer: withEncounterAppRoll(response.resolution, ready.appRoll) }
        })()
      : null
  // A won contest's outcome pauses on its own graph once both checks settled (D173).
  const outcomeAnswered =
    answered && priorContext?.contestPhase === 'OUTCOME'
      ? (() => {
          const { continuation, answer } = answered
          if (
            answer.kind !== 'ENTER_DICE' &&
            answer.kind !== 'ENTER_INTEGER' &&
            answer.kind !== 'SYSTEM_ROLL'
          )
            throw new EncounterValidationError('A contest outcome answers with its dice.')
          return { continuation, answer }
        })()
      : null
  const resumed =
    answered && pending && priorContext && !outcomeAnswered
      ? (() => {
          const participant: 'INITIATOR' | 'DEFENDER' =
            pending.request.nodeId === contest.initiator.requestNodeId ? 'INITIATOR' : 'DEFENDER'
          const { continuation, answer } = answered
          // A defender offered several checks picks one and rolls it in one answer (D152).
          const picksCheck = participant === 'DEFENDER' && contestDefenderPicksCheck(contest)
          if (picksCheck !== (answer.kind === 'CONTEST_CHECK'))
            throw new EncounterValidationError(
              picksCheck
                ? 'The contest defender picks one of its checks.'
                : 'A contest participant answers with d20 evidence.'
            )
          const resolution = requireEncounterD20Evidence(
            answer.kind === 'CONTEST_CHECK' ? answer.roll : answer,
            'A contest requires d20 evidence.'
          )
          return {
            participant,
            continuation,
            resolution,
            defenderCheckDefinitionId:
              answer.kind === 'CONTEST_CHECK' ? answer.checkDefinitionId : null,
            // The initiator's dice settle in the true sight mode (ATTACK-10.4, D100).
            initiatorSight:
              participant === 'INITIATOR'
                ? sightGovernedStageD20({
                    attackSight,
                    policy: contest.initiator,
                    stored: {
                      d20Belief: priorContext.d20Belief ?? null,
                      heldD20: priorContext.heldD20 ?? null
                    }
                  })
                : null
          }
        })()
      : null
  if (response && !resumed && !outcomeAnswered)
    throw new Error('The contest answer is unavailable.')
  const {
    checkDefinitionId: defenderCheckDefinitionId,
    label: _label,
    ...defender
  } = contestDefenderPolicy(
    contest.defender,
    contest.rollEvidence.defender?.checkDefinitionId ?? resumed?.defenderCheckDefinitionId ?? null
  )
  const record = (
    participant: 'INITIATOR' | 'DEFENDER',
    requestId: string,
    rawFaces: readonly number[]
  ) => {
    contest = withRollEvidence(contest, participant, requestId, rawFaces, defenderCheckDefinitionId)
  }
  const priorRolls = new Map<'INITIATOR' | 'DEFENDER', readonly number[]>()
  if (contest.rollEvidence.initiator)
    priorRolls.set('INITIATOR', contest.rollEvidence.initiator.rawFaces)
  if (contest.rollEvidence.defender)
    priorRolls.set('DEFENDER', contest.rollEvidence.defender.rawFaces)
  const occurrenceId = pending?.occurrenceId ?? crypto.randomUUID()
  const occurrenceVersion = ready.occurrenceVersion === null ? 0 : ready.occurrenceVersion + 1
  const execution = await executeEncounterOptionalContestAction({
    runtime: input.runtime,
    // Each participant's d20 goes to that actor's controllers; the initiator rolls their own.
    autoRoll: ready.autoRollByActorId,
    published: preparation.published,
    initiator: { ...contest.initiator, requestNodeId: 'initiator_d20' },
    defender: { ...defender, requestNodeId: 'target_d20' },
    occurrenceId,
    priorRolls,
    rollD20: () => input.random(20) + 1,
    ...(resumed
      ? {
          continuation: resumed.continuation,
          resolution: resumed.resolution,
          initiatorSight: resumed.initiatorSight
        }
      : {})
  })
  const planned = { ...scope, command, revisions: input.revisions }
  // The contest waits on the roller's answer to `continuation`'s request, its rolls so far sealed.
  const pendingContest = (
    continuation: ServerRuleExecutionContinuationDto,
    rolled: Pick<ContestPendingContext, 'rollerActorId' | 'contestPhase' | 'd20Belief' | 'heldD20'>
  ) => ({
    kind: 'PENDING' as const,
    input: liveSessionEncounterContestPendingInputSchema.parse({
      ...planned,
      snapshot: serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        applicationContext: {
          kind: 'ENCOUNTER_ACTION',
          schemaVersion: 1,
          commandJson: JSON.stringify(root),
          commandFingerprint: ready.fingerprint,
          initiatorUserId: ready.initiatorUserId,
          currentnessChecksum: checksumRuleDocument({ actor, target, sceneContext, contest }),
          d20Policy: null,
          twoPhase: null,
          contest,
          ...rolled
        }
      })
    })
  })
  if (execution.kind === 'PENDING') {
    // The answered participant's settled faces stay with the contest, unless a held die waits for one more.
    if (resumed && !execution.held)
      record(
        resumed.participant,
        resumed.resolution.requestId,
        execution.rolls.get(resumed.participant)!
      )
    const initiatorFaces = execution.rolls.get('INITIATOR')
    // An auto-rolled initiator keeps its faces for the defender's prompted answer.
    if (initiatorFaces && !contest.rollEvidence.initiator)
      record('INITIATOR', contest.initiator.requestNodeId, initiatorFaces)
    const d20Belief =
      execution.participant === 'INITIATOR' && attackSight
        ? encounterAttackD20Belief({
            gameSystemId: state.gameSystemId,
            policy: contest.initiator,
            trueSight: attackSight.trueSight,
            believedSight: attackSight.believedSight
          })
        : null
    return pendingContest(execution.continuation, {
      contestPhase: 'CHECKS',
      rollerActorId:
        execution.participant === 'INITIATOR' ? contest.initiator.actorId : defender.actorId,
      ...(d20Belief ? { d20Belief } : {}),
      ...(execution.held ? { heldD20: execution.held } : {})
    })
  }
  if (resumed)
    record(
      resumed.participant,
      resumed.resolution.requestId,
      (resumed.participant === 'INITIATOR' ? execution.initiator : execution.defender).rawFaces
    )
  // An answer to a won contest's outcome dice finds both checks already recorded.
  else if (!outcomeAnswered)
    for (const [participant, roll] of [
      ['INITIATOR', execution.initiator],
      ['DEFENDER', execution.defender]
    ] as const)
      record(participant, roll.requestNodeId, roll.rawFaces)
  const occurredAt = new Date().toISOString()
  const sourceWins = contestSourceWins(execution)
  const characterFacts = prepared?.targetFacts.characterFacts
  const success =
    sourceWins && contest.origin.kind === 'OPTIONAL_COMBAT'
      ? planEncounterDisarmSuccess({
          target,
          contest,
          character: characterFacts
            ? {
                id: characterFacts.active.id,
                streamVersion: characterFacts.active.play.streamVersion,
                document: characterFacts.character
              }
            : null
        })
      : null
  const win: ContestWin | null =
    sourceWins && prepared && contest.origin.kind === 'BASIC_ACTION'
      ? {
          prepared,
          occurrenceId,
          commandId: root.commandId,
          occurredAt,
          userId: ready.initiatorUserId
        }
      : null
  // A win holds the target (Grapple), or runs the outcome its initiator picked (Shove, D105).
  const hold =
    win && win.prepared.plan.kind === 'SINGLE_GRAPH'
      ? planNativeContestHold({
          ...win,
          published: preparation.published,
          rolls: execution,
          initiatorRequestId: contest.rollEvidence.initiator!.requestId,
          activeEffectsByActorId
        })
      : null
  const outcome =
    win && win.prepared.plan.kind === 'TEST_OUTCOME'
      ? await planNativeContestOutcome({
          ...win,
          execution: execution.execution,
          runtime: input.runtime,
          autoRoll: ready.autoRollByActorId[contest.initiator.actorId] === true,
          answered: outcomeAnswered,
          random: input.random
        })
      : null
  // The initiator rolls the won outcome's dice in the action roll window (D173).
  if (outcome?.kind === 'PENDING')
    return pendingContest(outcome.continuation, {
      contestPhase: 'OUTCOME',
      rollerActorId: contest.initiator.actorId
    })
  const settledTarget =
    success?.kind === 'CREATURE' ? success.actor : (hold?.actor ?? outcome?.actor ?? target)
  // A won escape frees its source from the holding effect and the conditions only it held.
  const escaped =
    sourceWins && settlement.kind === 'ESCAPE'
      ? {
          actor: encounterActorsAfterEscape({
            encounterId: state.id,
            actors,
            holderId: actor.id,
            holderEffects: settlement.holderEffects,
            activeEffectId: settlement.activeEffectId
          }).find((entry) => entry.id === actor.id)!,
          stateTransition: {
            kind: 'RELATIONSHIP_ENDED' as const,
            endedEffectId: settlement.activeEffectId,
            removedConditionIds: encounterEscapeEndedConditionIds(
              settlement.holderEffects,
              settlement.activeEffectId
            )
          }
        }
      : null
  // An optional combat initiator's attack roll uses up its one-roll grants (Vicious Mockery's
  // disadvantage) and releases the condition an ending effect alone held (Invisibility).
  const { consumedGrants: initiatorGrants, sourceReleases } = actionEndedEffects({
    holderActorId: actor.id,
    held: activeEffectsByActorId.get(actor.id) ?? [],
    makesAttackRoll: contest.origin.kind === 'OPTIONAL_COMBAT',
    againstEnemy: actsAgainstEnemy({
      actorId: actor.id,
      targetActorIds: [target.id],
      dispositions: new Map(actors.map(({ id, disposition }) => [id, disposition]))
    })
  })
  const sourceRelease =
    sourceReleases.length && prepared
      ? planNativeEncounterAreaSourceSpend(
          {
            prepared,
            encounterId: state.id,
            expectedEncounterVersion: state.version,
            occurrenceId,
            sourceCommandId: root.commandId,
            commandId: root.commandId,
            occurredAt,
            sourceReleases
          },
          ready.initiatorUserId
        )
      : null
  const releasedActor = sourceRelease?.settledSource ?? escaped?.actor ?? actor
  const spentActor = actionEconomy
    ? consumeEncounterActionEconomy({
        actor: releasedActor,
        consumption: actionEconomy,
        overridden: false
      })
    : releasedActor
  const settledActor = input.attackAction
    ? applyEncounterAttackActionTransition(spentActor, input.attackAction)
    : spentActor
  const nextActors = actors.map((entry) =>
    entry.id === settledActor.id
      ? settledActor
      : entry.id === settledTarget.id
        ? settledTarget
        : entry
  )
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterContestCommitInputSchema.parse({
      ...planned,
      occurredAt,
      contest,
      // The defender's check uses up its one-roll grants too (a Help's advantage).
      consumedGrants: [
        ...initiatorGrants,
        ...discoverEncounterEventHooks({
          effects: activeEffectsByActorId.get(target.id) ?? [],
          events: [{ kind: 'TEST', test: 'CHECK', ability: null }]
        }).ended
      ],
      createdEffect: hold?.record ?? null,
      forcedMovements: outcome?.forcedMovements ?? [],
      execution: storedRuleExecutionResultDtoSchema.parse({
        status: 'COMPLETE',
        occurrenceId,
        occurrenceVersion,
        outputs: execution.execution.outputs,
        evidence: execution.execution.evidence,
        applicationOutputs: contestApplicationOutputs({
          occurrenceId,
          contest,
          rolls: execution,
          stateTransition: success?.stateTransition ??
            hold?.stateTransition ??
            outcome?.stateTransition ??
            escaped?.stateTransition ?? { kind: 'NONE' },
          actionEconomy,
          attackAction: input.attackAction ?? null,
          sourceApplications: sourceRelease?.sourceResourcePlan?.receiptApplications ?? []
        })
      }),
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        { output: input.actorRules }
      )
    })
  }
}
