import { stageEncounterLegendaryActionRefreshes } from './encounterLegendaryActionDiscovery.js'
import { stageEncounterActionEconomyRefreshes } from './encounterActionEconomy.js'
import {
  encounterBasicActionEffects,
  withEncounterBasicActionEffects
} from './encounterBasicActions.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { turnLegendaryActionEvidenceDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import { projectNativeActionEffectTransitions } from './encounterActionEffectReceipts.js'
import { planNativeEncounterActionMechanics } from './encounterActionMechanicsPlan.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import { buildEncounterActionStoredExecution } from './encounterActionReceipt.js'
import {
  resolutionForRetainedEvidence,
  retainedD20Evidence,
  retainedIntegerEvidence
} from './encounterActionRetainedEvidence.js'
import type { discoverTurnLegendaryWindows } from './encounterTurnLegendaryDiscovery.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterWieldConflictAcceptance } from './encounterWieldConflict.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

type LegendaryEvidence = NonNullable<TurnCoordinatorRootDto['completedLegendaryActions']>[number]
type Choice = LegendaryEvidence['choice']
export type TurnLegendaryActionInput<
  TCharacterFacts extends ProjectableCharacterFacts = ProjectableCharacterFacts
> = {
  state: EncounterRunState
  userId: string
  /**
   * Each actor's roller preference: a Creature's controllers roll its Legendary Actions, and the
   * target's controllers roll its saves (ADR 0034).
   */
  autoRollByActorId: Readonly<Record<string, boolean>>
  occurrenceId: string
  root: TurnCoordinatorRootDto
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
  updatedAt: string
  refreshIncoming?: boolean
  actors: readonly EncounterRunActorState[]
  movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  startOutgoing?: boolean
  discoverWindows(input: {
    state: EncounterRunState
    occurrenceId: string
    outgoingActorId: string
    actors: readonly EncounterRunActorState[]
    movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  }): ReturnType<typeof discoverTurnLegendaryWindows>
  prepareMechanics(input: {
    actor: EncounterRunActorState
    target: EncounterRunActorState
    actors: readonly EncounterRunActorState[]
    actionId: string
    wieldConflictAcceptance: EncounterWieldConflictAcceptance
    movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  }): Promise<Awaited<ReturnType<typeof prepareEncounterActionMechanics<TCharacterFacts>>>>
  definitions: CurrentReusableDefinitionSource
  createRuntime(): Promise<RulesRuntimeService>
  random(maximum: number): number
}

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/**
 * Reconstructs every completed owner decision before extending a turn; it never writes mechanics.
 * A selected option runs the action it names through the same prepared, phased action path as any
 * other Encounter action (D51 option B), against the target its controller picked.
 */
export async function prepareTurnLegendaryActions<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: TurnLegendaryActionInput<TCharacterFacts>) {
  const { state, occurrenceId, userId } = input
  let root = input.root
  let actors = [...input.actors]
  const targets = new Map(input.movementTargets)
  if (state.automationMode === 'MANUAL') {
    if (root.completedLegendaryActions || root.legendaryActionQueue)
      throw new Error('Manual turns cannot contain Legendary Actions.')
    return { kind: 'COMPLETE' as const, root, actors, movementTargets: targets }
  }
  const windows =
    root.commandType === 'ADVANCE_TURN' &&
    (input.startOutgoing ||
      !root.outgoingTurn ||
      root.legendaryActionQueue ||
      root.completedLegendaryActions?.length)
      ? await input.discoverWindows({
          state,
          occurrenceId,
          actors: input.actors,
          movementTargets: input.movementTargets,
          outgoingActorId:
            state.currentActorId ??
            (() => {
              throw new Error('Outgoing turn is unavailable.')
            })()
        })
      : []
  let runtimePromise: Promise<RulesRuntimeService> | undefined
  const completed = [...(root.completedLegendaryActions ?? [])]
  const seen = new Set<string>()

  async function execute(
    choice: Choice,
    selection: { optionId: string; targetActorId: string },
    ordinal: number,
    retained?: LegendaryEvidence
  ) {
    const window = windows.find((entry) => entry.choice.ownerActorId === choice.ownerActorId)
    const option = choice.options.find((entry) => entry.optionId === selection.optionId)
    const candidate = window?.candidatesByOptionId.get(selection.optionId)
    if (!window || !same(window.choice, choice) || !option || !candidate)
      throw new Error('Legendary Action choice is stale.')
    const actor = actors.find((entry) => entry.id === choice.ownerActorId)
    const target = actors.find((entry) => entry.id === selection.targetActorId)
    if (!actor || actor.kind !== 'CREATURE')
      throw new Error('Legendary Action owner is unavailable.')
    if (!target || !option.targetActorIds.includes(target.id))
      throw new Error('Legendary Action target is unavailable.')
    // Earlier windows of this turn may have changed either actor; later stages see what they did.
    const prepared = await input.prepareMechanics({
      actor,
      target,
      actors,
      actionId: option.actionId,
      wieldConflictAcceptance: { kind: 'UNPROMPTED' },
      movementTargets: targets
    })
    if (checksumRuleDocument(prepared.plan) !== option.actionSourceChecksum)
      throw new Error('Legendary Action source is stale.')
    const execution = {
      runtime: await (runtimePromise ??= input.createRuntime()),
      adapter: prepared.adapter,
      plan: prepared.plan,
      occurrenceId,
      binding: prepared.binding,
      afterTest: async () => undefined
    }
    let result: Awaited<ReturnType<typeof advanceNativeActionGraphs>>
    if (retained) {
      if (retained.resolution.kind !== 'EXECUTED')
        throw new Error('Retained Legendary Action execution is unavailable.')
      // A settled window replays from its recorded dice and never rolls again.
      const receipt = retained.resolution
      const integers = retainedIntegerEvidence({ receipt })
      const d20 = retainedD20Evidence({ receipt })
      const used = new Set<string>()
      const replay = { ...execution, autoRoll: { SOURCE: false, TARGET: false } }
      result = await advanceNativeActionGraphs(replay)
      for (let count = 0; result.kind === 'PENDING'; count++) {
        if (count >= RULE_GRAPH_LIMITS.NODES)
          throw new Error('Retained Legendary Action evidence is invalid.')
        const resolution = resolutionForRetainedEvidence({ pending: result, integers, d20, used })
        result = await advanceNativeActionGraphs({
          ...replay,
          resume: { pending: result, resolution }
        })
      }
      if ([...integers.keys(), ...d20.keys()].some((requestId) => !used.has(requestId)))
        throw new Error('Retained Legendary Action evidence has unused requests.')
    } else {
      const kernel =
        input.pending?.snapshotKind === 'KERNEL_EVIDENCE' &&
        input.pending.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
          ? input.pending
          : null
      const context =
        kernel?.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
          ? kernel.applicationContext
          : null
      if (
        context &&
        (!same(context.choice, choice) ||
          context.selectedOption.optionId !== selection.optionId ||
          context.targetActorId !== selection.targetActorId)
      )
        throw new Error('Legendary Action evidence selection is stale.')
      const resolution = input.resolution
      const answer =
        resolution?.kind === 'ENTER_DICE' ||
        resolution?.kind === 'ENTER_INTEGER' ||
        resolution?.kind === 'SYSTEM_ROLL'
          ? resolution
          : null
      if (kernel && !answer) throw new Error('Legendary Action dice are required.')
      result = await advanceNativeActionGraphs({
        ...execution,
        random: input.random,
        autoRoll: {
          SOURCE: input.autoRollByActorId[actor.id] === true,
          TARGET: input.autoRollByActorId[target.id] === true
        },
        ...(kernel && context && answer
          ? {
              resume: {
                pending: {
                  kind: 'PENDING' as const,
                  continuation: (() => {
                    const {
                      snapshotKind: _kind,
                      applicationContext: _context,
                      optionalCombatSnapshotChecksum: _optional,
                      phaseReceipts: _phases,
                      ...value
                    } = kernel
                    return value
                  })(),
                  d20Policy: context.d20Policy,
                  twoPhase: context.twoPhase,
                  ...(kernel.phaseReceipts ? { phaseReceipts: kernel.phaseReceipts } : {})
                },
                resolution: answer
              }
            }
          : {})
      })
    }
    if (result.kind === 'PENDING') {
      if (retained) throw new Error('Retained Legendary Action execution is incomplete.')
      return {
        kind: 'PENDING' as const,
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...result.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          applicationContext: {
            kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
            schemaVersion: 1,
            root,
            choice,
            choiceSelectionChecksum: checksumCanonicalJson(choice),
            selectedOption: option,
            selectionChecksum: checksumCanonicalJson(option),
            targetActorId: target.id,
            rollerActorId: result.roller === 'SOURCE' ? actor.id : target.id,
            d20Policy: result.d20Policy,
            twoPhase: result.twoPhase
          },
          ...(result.phaseReceipts ? { phaseReceipts: result.phaseReceipts } : {})
        })
      }
    }
    if (
      prepared.adapter.interpretSpatial?.({
        execution: result.execution,
        occurrenceId,
        published: result.published,
        targetActorId: target.id
      }).length
    )
      throw new Error('Legendary Action requires the complete contextual action coordinator.')
    const plan = planNativeEncounterActionMechanics(
      {
        prepared,
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        occurrenceId,
        sourceCommandId: root.rootCommandId,
        commandId: root.rootCommandId,
        occurredAt: input.updatedAt,
        applications: result.applications,
        eventPhases: { resource: 'LEGENDARY_ACTION_RESOURCE', outcome: 'LEGENDARY_ACTION_OUTCOME' },
        ordinal
      },
      userId
    )
    const stored = buildEncounterActionStoredExecution({
      prepared,
      execution: result,
      occurrenceId,
      occurrenceVersion: 0,
      settled: plan,
      effects: projectNativeActionEffectTransitions({
        state: null,
        recurring: null,
        targetActorId: target.id
      }),
      maintainedState: null,
      maintenanceTransition: null,
      actionEconomy: null
    })
    if (stored.status !== 'COMPLETE') throw new Error('Legendary Action receipt is incomplete.')
    const targetCharacter = prepared.targetFacts.characterFacts
    const evidence = turnLegendaryActionEvidenceDtoSchema.parse({
      choice,
      selectionChecksum: checksumCanonicalJson(choice),
      resolution: {
        kind: 'EXECUTED',
        selectedOptionId: selection.optionId,
        targetActorId: target.id,
        execution: result.execution,
        initialFactsChecksum: result.initialFactsChecksum,
        ...(result.phaseReceipts ? { phaseReceipts: result.phaseReceipts } : {}),
        application: stored.applicationOutputs,
        characterTransitions:
          target.kind === 'CHARACTER' && targetCharacter && plan.mechanics.characterStreamVersion
            ? [
                {
                  characterId: target.sourceId,
                  beforeStreamVersion: targetCharacter.active.streamVersion,
                  afterStreamVersion: plan.mechanics.characterStreamVersion
                }
              ]
            : []
      }
    })
    if (retained && !same(evidence, retained))
      throw new Error('Retained Legendary Action execution is stale.')
    const settledTarget = target.id === actor.id ? plan.settledSource : plan.mechanics.updatedActor
    actors = actors.map((entry) =>
      entry.id === actor.id ? plan.settledSource : entry.id === target.id ? settledTarget : entry
    )
    for (const [settled, characterPlan] of [
      [plan.settledSource, target.id === actor.id ? plan.targetPlan : null],
      ...(target.id === actor.id ? [] : [[settledTarget, plan.targetPlan] as const])
    ] as const) {
      const current = prepared.movementTargets.get(settled.id)
      if (!current) throw new Error('Legendary Action actor facts are unavailable.')
      targets.set(
        settled.id,
        projectEncounterActionTarget({
          target: current,
          actor: settled,
          plan: characterPlan,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.updatedAt
        })
      )
    }
    return { kind: 'COMPLETE' as const, evidence }
  }

  for (const [ordinal, evidence] of completed.entries()) {
    const ownerId = evidence.choice.ownerActorId
    if (
      seen.has(ownerId) ||
      !same(windows.find((entry) => entry.choice.ownerActorId === ownerId)?.choice, evidence.choice)
    )
      throw new Error('Retained Legendary Action owner is stale.')
    seen.add(ownerId)
    const decision = root.resolutionCommands.find(
      (entry) =>
        (entry.kind === 'LEGENDARY_DECLINE' || entry.kind === 'LEGENDARY_OPTION') &&
        entry.selectionChecksum === evidence.selectionChecksum
    )
    if (
      !decision ||
      (evidence.resolution.kind === 'DECLINED'
        ? decision.kind !== 'LEGENDARY_DECLINE'
        : decision.kind !== 'LEGENDARY_OPTION' ||
          decision.optionId !== evidence.resolution.selectedOptionId ||
          decision.targetActorId !== evidence.resolution.targetActorId)
    )
      throw new Error('Retained Legendary Action decision is stale.')
    if (evidence.resolution.kind === 'EXECUTED')
      await execute(
        evidence.choice,
        {
          optionId: evidence.resolution.selectedOptionId,
          targetActorId: evidence.resolution.targetActorId
        },
        ordinal,
        evidence
      )
  }

  if (root.commandType === 'ADVANCE_TURN' && (input.startOutgoing || !root.outgoingTurn)) {
    root = {
      ...root,
      outgoingTurn: root.outgoingTurn ?? { kind: 'NONE' },
      ...(windows.length
        ? {
            legendaryActionQueue: {
              ownerActorIds: windows.map((entry) => entry.choice.ownerActorId),
              nextOwnerIndex: 0
            }
          }
        : {})
    }
  }
  const queue = root.legendaryActionQueue
  if (queue) {
    if (
      completed.some((entry) => {
        const index = queue.ownerActorIds.indexOf(entry.choice.ownerActorId)
        return index < 0 || index >= queue.nextOwnerIndex
      })
    )
      throw new Error('Legendary Action owner queue is stale.')
    let index = queue.nextOwnerIndex
    const context = input.pending?.applicationContext
    if (
      context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
      context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
    ) {
      const choice = context.choice
      if (input.pending?.occurrenceId !== occurrenceId)
        throw new Error('Legendary Action pending occurrence is stale.')
      if (!same(context.root, root)) throw new Error('Legendary Action pending turn root is stale.')
      if (choice.ownerActorId !== queue.ownerActorIds[index] || seen.has(choice.ownerActorId))
        throw new Error('Legendary Action pending owner is stale.')
      if (
        input.resolution?.kind === 'DECLINE' &&
        context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'
      ) {
        if (
          !same(
            windows.find((entry) => entry.choice.ownerActorId === choice.ownerActorId)?.choice,
            choice
          )
        )
          throw new Error('Legendary Action choice is stale.')
        completed.push({
          choice,
          selectionChecksum: checksumCanonicalJson(choice),
          resolution: { kind: 'DECLINED' }
        })
      } else {
        const selection =
          context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
            ? { optionId: context.selectedOption.optionId, targetActorId: context.targetActorId }
            : input.resolution?.kind === 'LEGENDARY_OPTION'
              ? {
                  optionId: input.resolution.optionId,
                  targetActorId: input.resolution.targetActorId
                }
              : null
        if (!selection) throw new Error('Legendary Action choice is required.')
        const result = await execute(choice, selection, completed.length)
        if (result.kind === 'PENDING') return result
        completed.push(result.evidence)
      }
      index += 1
    }
    root = { ...root, completedLegendaryActions: completed }
    for (; index < queue.ownerActorIds.length; index += 1) {
      const window = windows.find(
        (entry) => entry.choice.ownerActorId === queue.ownerActorIds[index]
      )
      if (!window) continue
      root = { ...root, legendaryActionQueue: { ...queue, nextOwnerIndex: index } }
      return {
        kind: 'PENDING' as const,
        snapshot: serverAggregateChoicePendingSnapshotDtoSchema.parse({
          snapshotKind: 'AGGREGATE_CHOICE',
          schemaVersion: 1,
          occurrenceId,
          applicationContext: {
            kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE',
            schemaVersion: 1,
            root,
            choice: window.choice,
            selectionChecksum: checksumCanonicalJson(window.choice)
          }
        })
      }
    }
    root = { ...root, legendaryActionQueue: undefined }
  }
  const currentActorId = root.proposedTerminalTransition.currentActorId
  if (currentActorId && input.refreshIncoming !== false) {
    const facts = buildEncounterActorRuleFacts({ actors })
    const refresh = await stageEncounterLegendaryActionRefreshes({
      actorId: currentActorId,
      encounter: { ...state, actors },
      actorRules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      ),
      definitions: {
        requireCurrent: async (id) => {
          const definition = await input.definitions.requireCurrent(id)
          if (definition.gameSystemId !== state.gameSystemId)
            throw new Error('Legendary Action refresh definition is unavailable.')
          return definition
        }
      }
    })
    if (
      root.stagedLegendaryActionRefreshes &&
      !same(root.stagedLegendaryActionRefreshes, refresh.refreshes)
    )
      throw new Error('Legendary Action refresh is stale.')
    if (refresh.refreshes.length)
      root = { ...root, stagedLegendaryActionRefreshes: [...refresh.refreshes] }
    if (refresh.refreshedActor)
      actors = actors.map((actor) =>
        actor.id === refresh.refreshedActor!.id ? refresh.refreshedActor! : actor
      )
    const entering = actors.find((actor) => actor.id === currentActorId)
    if (!entering) throw new Error('Incoming action-economy actor is unavailable.')
    const actionEconomy = await stageEncounterActionEconomyRefreshes({
      actor: entering,
      state,
      definitions: input.definitions
    })
    if (
      root.stagedActionEconomyRefreshes !== undefined &&
      !same(root.stagedActionEconomyRefreshes, actionEconomy.refreshes)
    )
      throw new Error('Action-economy refresh is stale.')
    if (actionEconomy.refreshes.length)
      root = { ...root, stagedActionEconomyRefreshes: actionEconomy.refreshes }
    if (actionEconomy.refreshedActor)
      actors = actors.map((actor) =>
        actor.id === actionEconomy.refreshedActor!.id ? actionEconomy.refreshedActor! : actor
      )
    // The entering actor's basic-action effects (Dodge, Help, Disengage) end as its turn starts.
    const refreshed = actors.find((actor) => actor.id === currentActorId)!
    const expiring = encounterBasicActionEffects(refreshed)
    if (root.stagedBasicActionExpiry !== undefined && !same(root.stagedBasicActionExpiry, expiring))
      throw new Error('Basic action expiry is stale.')
    if (expiring.length) {
      root = { ...root, stagedBasicActionExpiry: expiring }
      actors = actors.map((actor) =>
        actor.id === refreshed.id ? withEncounterBasicActionEffects(refreshed, []) : actor
      )
    }
  }
  return { kind: 'COMPLETE' as const, root, actors, movementTargets: targets }
}
