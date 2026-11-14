import type { LiveSessionEncounterGatedActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  admitActionCommit,
  requireActionCommitFence,
  requireRuleOutputScope
} from './actionCommitFences.js'
import { completeActionOccurrence, recordActionCommit } from './actionCommitRecords.js'
import {
  applyActionSpendMechanics,
  requireSourceSpendReceipt,
  settleActionSourceSpend,
  sourceSpendMutation
} from './actionSourceSpend.js'
import { endEffects } from './consumedGrantPersistence.js'
import { readRunActors } from './documents.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import { sameGate } from './actionPending.js'
import { recordIncomingGateRollCards } from './actionRollCards.js'

/**
 * Commits an action its incoming gate stopped, in the transaction of the roll that failed it: the root
 * with the source's one spend and nothing of the action. When the roll was asked of a player, the
 * sealed offer the answer resumed must be the gate the root records.
 */
export async function persistEncounterGatedActionCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: LiveSessionEncounterGatedActionCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await admitActionCommit(ctx, input)
  if (admission.kind === 'REPLAY') return admission.result
  const { state, campaign, resume, initiatorUserId } = admission
  const command = admission.input
  const rootExecution = input.execution
  const { response } = input
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.optionalCombatIntent != null ||
    rootExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
    rootExecution.applicationOutputs.kind !== 'ENCOUNTER_GATED_ACTION' ||
    rootExecution.applicationOutputs.parentOccurrenceId !== undefined ||
    rootExecution.occurrenceVersion !== (resume ? resume.occurrence.version + 1 : 0) ||
    (resume && rootExecution.occurrenceId !== resume.occurrence.id) ||
    // A save asked of a player is always the answer to the pause that offered it.
    Boolean(resume) !== Boolean(response)
  )
    throw new Error('Live Session terminal action is not an ordinary gated action.')
  const root = rootExecution.applicationOutputs
  // The failed save is lost by its roll, or by the attacker declining the retarget it earned.
  const pause = resume?.pending.context.pause
  const retarget = pause?.kind === 'ATTACK_RETARGET' ? pause.payload : null
  const offered = pause?.kind === 'INCOMING_GATE' ? pause.payload : retarget?.gate
  if (
    resume &&
    (!offered ||
      !response ||
      (retarget
        ? response.resolution.kind !== 'DECLINE' ||
          checksumCanonicalJson(retarget.gate.d20) !== checksumCanonicalJson(root.gate.d20)
        : response.resolution.kind !== 'ENTER_DICE' &&
          response.resolution.kind !== 'SYSTEM_ROLL') ||
      !sameGate(offered, root.gate) ||
      offered.checkDefinitionId !== root.gate.checkDefinitionId ||
      offered.dc !== root.gate.dc)
  )
    throw new Error('Live Session gated action offer mismatch.')
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session gated action offer mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const { origin } = root.gate
  if (
    !source ||
    root.sourceActorId !== source.id ||
    root.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null) ||
    // A ward is another creature's; a trigger's check is owed only by a reaction child.
    (origin.kind === 'WARD'
      ? origin.holderActorId === source.id ||
        !actors.some((actor) => actor.id === origin.holderActorId)
      : command.systemTrigger?.trigger !== 'REACTION')
  )
    throw new Error('Live Session gated action actor scope mismatch.')
  requireRuleOutputScope(actors, input.rules, 'gated action')
  await requireActionCommitFence(ctx, {
    state,
    characterIds: actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    revisions: input.revisions,
    occurrenceIds: [root.occurrenceId],
    pendingOccurrence: resume?.occurrence ?? null,
    validateReadFence: callbacks.validateReadFence
  })

  const { spends, mutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    spell: input.spellConsumption,
    receipts: root
  })
  const sourceMechanics =
    source.kind === 'CHARACTER' && (spends || root.sourceApplications.length)
      ? await applyActionSpendMechanics(ctx, {
          state,
          occurrenceId: root.occurrenceId,
          sourceCommandId: command.commandId,
          occurredAt: input.occurredAt,
          actor: source,
          applications: root.sourceApplications,
          mutation,
          applyMechanics: callbacks.applyMechanics,
          currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
        })
      : null
  requireSourceSpendReceipt(sourceMechanics, root)

  const settledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: sourceMechanics?.updatedActor ?? source,
    spend: { ...root, attackActionTransition: undefined },
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  const endedMaintainedStates = await endEffects(ctx, input.consumedGrants)
  const nextActors = actors.map((actor) => (actor.id === source.id ? settledSource : actor))
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const completedOccurrence = await completeActionOccurrence(ctx, {
    state,
    nextState,
    occurrenceId: root.occurrenceId,
    rootCommandId: command.commandId,
    version: rootExecution.occurrenceVersion,
    resume: resume ? { occurrence: resume.occurrence } : null,
    occurredAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  // A failed gate is carded as a passed one is, from the source who rolled it.
  await recordIncomingGateRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    occurrenceId: root.occurrenceId,
    roller: source,
    // The saves that turned the action before this one, then the one that lost it.
    gates: [...(resume?.pending.context.retargeted ?? []), root.gate],
    response,
    responderUserId: input.expectedUserId,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt
  })
  return recordActionCommit(ctx, {
    admission,
    command,
    nextState,
    projection,
    completedOccurrence,
    execution: rootExecution,
    definitionId: input.initialDefinitionId,
    // No graph ran: the receipt names the facts the held action was prepared against.
    factsChecksum: input.currentnessChecksum,
    response,
    userId: input.expectedUserId,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: input.consumedGrants,
      endedMaintainedStates,
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      teleportAllowanceTurn: null,
      turnUses: null
    },
    occurredAt: input.occurredAt
  })
}
