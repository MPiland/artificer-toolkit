import { executeEncounterMovementReactionAction } from './encounterMovementReactionActionExecution.js'
import { stageEncounterLegendaryActionRefreshes } from './encounterLegendaryActionDiscovery.js'
import { stageEncounterActionEconomyRefreshes } from './encounterActionEconomy.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { turnLegendaryActionEvidenceDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { planNativeEncounterActionMechanics } from './encounterActionMechanicsPlan.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { discoverTurnLegendaryWindows } from './encounterTurnLegendaryDiscovery.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterWieldConflictAcceptance } from './encounterWieldConflict.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

type LegendaryEvidence = NonNullable<TurnCoordinatorRootDto['completedLegendaryActions']>[number]
type Choice = LegendaryEvidence['choice']
export type TurnLegendaryActionInput<
  TCharacterFacts extends ProjectableCharacterFacts = ProjectableCharacterFacts
> = {
  state: EncounterRunState
  userId: string
  occurrenceId: string
  root: TurnCoordinatorRootDto
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: ResolveRuleOccurrenceInputDto['resolution']
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
  rollD20(): number
}

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/** Reconstructs every completed owner decision before extending a turn; it never writes mechanics. */
export async function prepareTurnLegendaryActions<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: TurnLegendaryActionInput<TCharacterFacts>) {
  const { state, occurrenceId, userId } = input
  let root = input.root
  const durable = input.actors
  let actors = [...durable]
  if (state.automationMode === 'MANUAL') {
    if (root.completedLegendaryActions || root.legendaryActionQueue)
      throw new Error('Manual turns cannot contain Legendary Actions.')
    return { kind: 'COMPLETE' as const, root, actors }
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
          actors: durable,
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

  async function execute(choice: Choice, optionId: string, retained?: LegendaryEvidence) {
    const window = windows.find((entry) => entry.choice.ownerActorId === choice.ownerActorId)
    const option = choice.options.find((entry) => entry.optionId === optionId)
    const candidate = window?.candidatesByOptionId.get(optionId)
    if (!window || !same(window.choice, choice) || !option || !candidate)
      throw new Error('Legendary Action choice is stale.')
    const actor = durable.find((entry) => entry.id === choice.ownerActorId)
    if (!actor || actor.kind !== 'CREATURE' || option.targetActorId !== actor.id)
      throw new Error('Legendary Action owner is unavailable.')
    const prepared = await input.prepareMechanics({
      actor,
      target: actor,
      actors: durable,
      actionId: option.actionId,
      wieldConflictAcceptance: { kind: 'UNPROMPTED' },
      ...(input.movementTargets?.has(actor.id) ? { movementTargets: input.movementTargets } : {})
    })
    const published = prepared.adapter.compile({ action: candidate.action })
    if (published.checksum !== option.actionSourceChecksum)
      throw new Error('Legendary Action source is stale.')
    if (prepared.adapter.activeEffectPlans?.({ action: candidate.action, published }).length)
      throw new Error('Legendary Action requires the complete active-effect coordinator.')
    const kernel =
      input.pending?.snapshotKind === 'KERNEL_EVIDENCE' &&
      input.pending.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
        ? input.pending
        : null
    const kernelContext =
      kernel?.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
        ? kernel.applicationContext
        : null
    const retainedApplication =
      retained?.resolution.kind === 'EXECUTED' ? retained.resolution.application : null
    const faces =
      retainedApplication &&
      (retainedApplication.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
        retainedApplication.kind === 'CHARACTER_MECHANICS_BATCH')
        ? [...(retainedApplication.d20?.rawFaces ?? [])]
        : []
    let faceIndex = 0
    const continuation = kernel
      ? (() => {
          const {
            snapshotKind: _kind,
            applicationContext: _context,
            optionalCombatSnapshotChecksum: _optional,
            phaseReceipts: _phases,
            ...value
          } = kernel
          return value
        })()
      : undefined
    if (
      kernelContext &&
      !retained &&
      (!same(kernelContext.choice, choice) || !same(kernelContext.selectedOption, option))
    )
      throw new Error('Legendary Action evidence selection is stale.')
    const resolution = input.resolution
    if (
      kernel &&
      !retained &&
      resolution?.kind !== 'ENTER_DICE' &&
      resolution?.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('Legendary Action dice are required.')
    const binding = prepared.binding
    const execution = await executeEncounterMovementReactionAction({
      runtime: await (runtimePromise ??= input.createRuntime()),
      occurrenceId,
      automationMode: retained ? 'AUTOMATIC' : (state.automationMode as 'AUTOMATIC' | 'ASSISTED'),
      prepared: {
        adapter: prepared.adapter,
        published,
        actionMechanic: binding.actionMechanic,
        sourceDerivedFacts: binding.sourceDerivedFacts,
        target: {
          actorId: actor.id,
          currentHitPoints: binding.currentHitPoints,
          temporaryHitPoints: binding.temporaryHitPoints,
          maximumHitPoints: binding.maximumHitPoints,
          scalarValues: binding.targetScalarValues,
          conditionIds: binding.targetConditionIds,
          derivedFacts: binding.targetDerivedFacts,
          defenses: binding.defenses,
          conditionImmunityIds: binding.conditionImmunityIds
        }
      },
      ...(kernelContext &&
      continuation &&
      !retained &&
      (resolution?.kind === 'ENTER_DICE' || resolution?.kind === 'SYSTEM_ROLL')
        ? {
            continuation,
            expectedD20Policy: kernelContext.d20Policy,
            resolution
          }
        : {}),
      rollD20: retained
        ? () => {
            const face = faces[faceIndex++]
            if (face === undefined)
              throw new Error('Retained Legendary Action dice are incomplete.')
            return face
          }
        : input.rollD20
    })
    if (execution.kind === 'PENDING') {
      return {
        kind: 'PENDING' as const,
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...execution.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          applicationContext: {
            kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
            schemaVersion: 1,
            root,
            choice,
            choiceSelectionChecksum: checksumCanonicalJson(choice),
            selectedOption: option,
            selectionChecksum: checksumCanonicalJson(option),
            d20Policy: execution.d20Policy
          }
        })
      }
    }
    if (retained && faceIndex !== faces.length)
      throw new Error('Retained Legendary Action dice are inconsistent.')
    if (
      prepared.adapter.interpretSpatial?.({
        execution: execution.execution,
        occurrenceId,
        published,
        targetActorId: actor.id
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
        applications: execution.applications,
        eventPhases: { resource: 'LEGENDARY_ACTION_RESOURCE', outcome: 'LEGENDARY_ACTION_OUTCOME' }
      },
      userId
    )
    const evidence = turnLegendaryActionEvidenceDtoSchema.parse({
      choice,
      selectionChecksum: checksumCanonicalJson(choice),
      resolution: {
        kind: 'EXECUTED',
        selectedOptionId: optionId,
        execution: execution.execution,
        application: {
          kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
          schemaVersion: 1,
          occurrenceId,
          sourceActorId: actor.id,
          targetActorId: actor.id,
          sourceCharacterStreamVersion: null,
          resourceConsumption: null,
          featureResourceConsumption: plan.featureResourceReceipt,
          d20: execution.d20,
          nestedD20: null,
          targetTransition: plan.mechanics.targetTransition,
          applications: plan.mechanics.receiptApplications
        },
        characterTransitions: []
      }
    })
    if (retained && !same(evidence, retained))
      throw new Error('Retained Legendary Action execution is stale.')
    actors = actors.map((entry) => (entry.id === actor.id ? plan.settledSource : entry))
    return { kind: 'COMPLETE' as const, evidence }
  }

  for (const evidence of completed) {
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
          decision.optionId !== evidence.resolution.selectedOptionId)
    )
      throw new Error('Retained Legendary Action decision is stale.')
    if (evidence.resolution.kind === 'EXECUTED')
      await execute(evidence.choice, evidence.resolution.selectedOptionId, evidence)
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
        const optionId =
          context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
            ? context.selectedOption.optionId
            : input.resolution?.kind === 'OPTION'
              ? input.resolution.optionId
              : null
        if (!optionId) throw new Error('Legendary Action choice is required.')
        const result = await execute(choice, optionId)
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
  }
  return { kind: 'COMPLETE' as const, root, actors }
}
