import {
  actionTargetActorId,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterDisarmCommitInputSchema,
  liveSessionEncounterDisarmPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterDisarm'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterAttackD20Belief } from '@artificer-toolkit/rules-runtime/encounterAttackBelief'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  disarmApplicationOutputs,
  disarmSourceWins,
  planEncounterDisarmSuccess,
  prepareEncounterDisarmContest,
  readEncounterDisarmSelection,
  requireEncounterDisarmDefinition
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import { planNativeEncounterAreaSourceSpend } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { actionEndedEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { effectsEndedBy } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { executeEncounterOptionalContestAction } from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { sightGovernedStageD20 } from '@artificer-toolkit/rules-runtime/encounterSightGovernedD20'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  readNativeLiveAttackPerception,
  readNativeLiveSourcesSeen
} from './nativeAttackPerception.js'
import { captureActionEconomyDefinitions } from './nativeEncounterActionEconomy.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/** The contest with one participant's settled faces recorded as its roll evidence. */
function withRollEvidence(
  contest: ReturnType<typeof prepareEncounterDisarmContest>['contest'],
  participant: 'INITIATOR' | 'DEFENDER',
  requestId: string,
  rawFaces: readonly number[]
) {
  return {
    ...contest,
    rollEvidence: {
      ...contest.rollEvidence,
      [participant === 'INITIATOR' ? 'initiator' : 'defender']: {
        requestId,
        rawFaces: [...rawFaces]
      }
    }
  }
}

/**
 * Plans a Disarm, or a participant's d20 for one, in the room: both contest d20s roll here with the
 * room's randomness and each participant's auto-roll preference. Convex stores the paused contest or
 * re-applies the settled item and ACTION changes; it never rolls.
 */
export async function planNativeLiveDisarm(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
  }
) {
  const request = { kind: 'DISARM' as const, command }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted Disarm lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    command.encounterId.toLowerCase() !== initial.encounterId ||
    command.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live Disarm scope mismatch.')
  const reads = liveEncounterCaptures(initial, executionOptions.captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const ready = admission.ready
  if (!ready) throw new Error('The Disarm is unavailable.')
  const root = ready.command
  const targetActorId = actionTargetActorId(root.target)
  const intent = root.optionalCombatIntent
  if (!intent) throw new Error('Optional combat Disarm is unavailable.')
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Disarm Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const actor = actors.find((entry) => entry.id === root.actorId)
  const target = actors.find((entry) => entry.id === targetActorId)
  if (!actor || !target) throw new Error('Disarm actors are unavailable.')
  const loadTarget = async (entry: (typeof actors)[number]) => {
    const prepared = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor: entry,
      activeEffectsByActorId,
      captures: executionOptions.captures
    })
    reads.observe(prepared.revisions)
    return prepared.target
  }
  const movementTargets = new Map(
    await Promise.all(
      [actor, target].map(async (entry) => [entry.id, await loadTarget(entry)] as const)
    )
  )
  const definition = requireEncounterDisarmDefinition({
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
        grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
          encounter: state,
          sceneGrid: scene.sceneGrid
        })
      }
    : null
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor,
    target,
    actors,
    actionId: root.actionId,
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
    loadSource: async (input) => resolveEncounterActionSource({ ...input, system }),
    loadRelationshipFacts: async (input) =>
      lockedRelationshipActionFacts({
        actionEffectId: input.actionEffectId,
        sourceActorId: input.sourceActorId,
        targetActorId: input.targetActorId,
        targets: { activeEffectsByActorId }
      })
  })
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
  const actionEconomy = await prepareEncounterActionEconomy({
    actor,
    state,
    activation: { code: 'ACTION', amount: 1 },
    target: prepared.sourceFacts,
    loadTarget: async () => movementTargets.get(actor.id),
    definitions: captureActionEconomyDefinitions(capture)
  })
  const pending = ready.snapshot
  const priorContext =
    pending?.snapshotKind === 'KERNEL_EVIDENCE' &&
    pending.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    pending.applicationContext.contest
      ? { ...pending.applicationContext, contest: pending.applicationContext.contest }
      : null
  if (pending && !priorContext) throw new Error('The pending Disarm contest is unavailable.')
  const preparation = prepareEncounterDisarmContest({
    state,
    actor,
    target,
    command: root,
    definition,
    prepared,
    sceneContext,
    selection,
    system,
    actionEconomy,
    ...(priorContext ? { priorContest: priorContext.contest } : {})
  })
  if (priorContext && preparation.currentnessChecksum !== priorContext.currentnessChecksum)
    throw new Error('The pending Disarm source or target changed.')
  let contest = preparation.contest
  const response = command.type === 'RESOLVE_RULE_OCCURRENCE' ? command : null
  const resumed =
    response && pending && priorContext
      ? (() => {
          const participant: 'INITIATOR' | 'DEFENDER' =
            pending.request.nodeId === contest.initiator.requestNodeId ? 'INITIATOR' : 'DEFENDER'
          // An app roll settles with the faces Convex recorded for it, never client-supplied values.
          const answer = withEncounterAppRoll(response.resolution, ready.appRoll)
          if (answer.kind !== 'ENTER_DICE' && answer.kind !== 'SYSTEM_ROLL')
            throw new Error('Disarm requires d20 evidence.')
          const {
            snapshotKind: _snapshotKind,
            applicationContext: _applicationContext,
            optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
            phaseReceipts: _phaseReceipts,
            deferredCleaving: _deferredCleaving,
            ...continuation
          } = pending
          return {
            participant,
            continuation,
            resolution: answer,
            // The initiator's dice settle in the true sight mode (ATTACK-10.4, D100).
            initiatorSight:
              participant === 'INITIATOR'
                ? sightGovernedStageD20({
                    attackSight: prepared.attackSight,
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
  if (response && !resumed) throw new Error('The Disarm answer is unavailable.')
  const priorRolls = new Map<'INITIATOR' | 'DEFENDER', readonly number[]>()
  if (contest.rollEvidence.initiator)
    priorRolls.set('INITIATOR', contest.rollEvidence.initiator.rawFaces)
  if (contest.rollEvidence.defender)
    priorRolls.set('DEFENDER', contest.rollEvidence.defender.rawFaces)
  const occurrenceId = pending?.occurrenceId ?? crypto.randomUUID()
  const occurrenceVersion = ready.occurrenceVersion === null ? 0 : ready.occurrenceVersion + 1
  const { checkDefinitionId: _checkDefinitionId, ...defender } = contest.defender
  const execution = await executeEncounterOptionalContestAction({
    runtime: executionOptions.runtime,
    // Each participant's d20 goes to that actor's controllers; the initiator rolls their own.
    autoRoll: ready.autoRollByActorId,
    graph: preparation.graph,
    initiator: { ...contest.initiator, requestNodeId: 'initiator_d20' },
    defender: { ...defender, requestNodeId: 'target_d20' },
    occurrenceId,
    priorRolls,
    rollD20: () => executionOptions.random(20) + 1,
    ...(resumed
      ? {
          continuation: resumed.continuation,
          resolution: resumed.resolution,
          initiatorSight: resumed.initiatorSight
        }
      : {})
  })
  const planned = { ...scope, command, revisions: reads.revisions() }
  if (execution.kind === 'PENDING') {
    // The answered participant's settled faces stay with the contest, unless a held die waits for one more.
    if (resumed && !execution.held)
      contest = withRollEvidence(
        contest,
        resumed.participant,
        resumed.resolution.requestId,
        execution.rolls.get(resumed.participant)!
      )
    const initiatorFaces = execution.rolls.get('INITIATOR')
    // An auto-rolled initiator keeps its faces for the defender's prompted answer.
    if (initiatorFaces && !contest.rollEvidence.initiator)
      contest = withRollEvidence(
        contest,
        'INITIATOR',
        contest.initiator.requestNodeId,
        initiatorFaces
      )
    const d20Belief =
      execution.participant === 'INITIATOR' && prepared.attackSight
        ? encounterAttackD20Belief({
            policy: contest.initiator,
            trueSight: prepared.attackSight.trueSight,
            believedSight: prepared.attackSight.believedSight
          })
        : null
    return {
      kind: 'PENDING' as const,
      input: liveSessionEncounterDisarmPendingInputSchema.parse({
        ...planned,
        snapshot: serverRuleExecutionPendingSnapshotDtoSchema.parse({
          ...execution.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
          applicationContext: {
            kind: 'ENCOUNTER_ACTION',
            schemaVersion: 1,
            commandJson: JSON.stringify(root),
            commandFingerprint: ready.fingerprint,
            initiatorUserId: ready.initiatorUserId,
            rollerActorId:
              execution.participant === 'INITIATOR' ? contest.initiator.actorId : defender.actorId,
            currentnessChecksum: checksumRuleDocument({ actor, target, sceneContext, contest }),
            d20Policy: null,
            twoPhase: null,
            contest,
            ...(d20Belief ? { d20Belief } : {}),
            ...(execution.held ? { heldD20: execution.held } : {})
          }
        })
      })
    }
  }
  if (resumed)
    contest = withRollEvidence(
      contest,
      resumed.participant,
      resumed.resolution.requestId,
      (resumed.participant === 'INITIATOR' ? execution.initiator : execution.defender).rawFaces
    )
  else
    for (const [participant, roll] of [
      ['INITIATOR', execution.initiator],
      ['DEFENDER', execution.defender]
    ] as const)
      contest = withRollEvidence(contest, participant, roll.requestNodeId, roll.rawFaces)
  const characterFacts = prepared.targetFacts.characterFacts
  const success = disarmSourceWins(execution)
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
  const settledTarget = success?.kind === 'CREATURE' ? success.actor : target
  // The initiator's attack roll uses up its one-roll grants (Vicious Mockery's disadvantage) and
  // releases the condition an ending effect alone held (Invisibility).
  const { consumedGrants: initiatorGrants, sourceReleases } = actionEndedEffects({
    holderActorId: actor.id,
    held: activeEffectsByActorId.get(actor.id) ?? [],
    makesAttackRoll: true
  })
  const occurredAt = new Date().toISOString()
  const sourceRelease = sourceReleases.length
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
  const releasedActor = sourceRelease?.settledSource ?? actor
  const settledActor = actionEconomy
    ? consumeEncounterActionEconomy({
        actor: releasedActor,
        consumption: actionEconomy,
        overridden: false
      })
    : releasedActor
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
    input: liveSessionEncounterDisarmCommitInputSchema.parse({
      ...planned,
      occurredAt,
      contest,
      // The defender's check uses up its one-roll grants too (a Help's advantage).
      consumedGrants: [
        ...initiatorGrants,
        ...effectsEndedBy(activeEffectsByActorId.get(target.id) ?? [], 'ON_ABILITY_CHECK')
      ],
      execution: storedRuleExecutionResultDtoSchema.parse({
        status: 'COMPLETE',
        occurrenceId,
        occurrenceVersion,
        outputs: execution.execution.outputs,
        evidence: execution.execution.evidence,
        applicationOutputs: disarmApplicationOutputs({
          occurrenceId,
          contest,
          rolls: execution,
          stateTransition: success?.stateTransition ?? { kind: 'NONE' },
          actionEconomy,
          sourceApplications: sourceRelease?.sourceResourcePlan?.receiptApplications ?? []
        })
      }),
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        { output: prepared.actorRules }
      )
    })
  }
}
