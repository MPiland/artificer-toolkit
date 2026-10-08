import type { LiveSessionEncounterTurnCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { type EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunStateSchema,
  type EncounterRunState,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { applyEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { skippedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  legendaryActionDamage,
  nativeConcentrationDamageApplications
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type {
  ConcentrationDamageApplicationDto,
  concentrationMaintainedDamageApplicationDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readRunActors } from './documents.js'
import { readNativeTurnSettlement } from './turnSettlement.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import { correctInitiativeCursor } from './initiativeCorrection.js'
import { completeNativeInitiativeOccurrence } from './initiativeTerminalCompletion.js'
import { readLiveEncounterTurnAdmission } from './turnCommandAdmission.js'
import { persistEncounterTurnEffects } from './turnEffectsPersistence.js'
import { persistEncounterTurnResources } from './turnResourcesPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'

/** Commits a DO-computed turn in one transaction, using the native normalized writes and receipts. */
export async function persistEncounterTurnCommit(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterTurnCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterTurnCommitInput,
      maintenanceOwners: LiveSessionEncounterTurnCommitInput['maintenanceOwners']
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    readDefinition(id: string, userId: string): Promise<ReusableDefinitionCurrentDto | null>
    bindConcentrationApplications(
      state: EncounterRunState,
      applications: readonly ConcentrationDamageApplicationDto[]
    ): Promise<ReturnType<typeof concentrationMaintainedDamageApplicationDtoSchema.parse>[]>
    persistConcentrationChildren(
      input: {
        state: EncounterRunState
        actors: EncounterRunActorState[]
        parentOccurrenceId: string
        parentCommandFingerprint: string
        finalizedDamageEnvelopeChecksum: string
        remaining: readonly ReturnType<
          typeof concentrationMaintainedDamageApplicationDtoSchema.parse
        >[]
        correlationId: string
        userId: string
        authorizedCharacterIds: ReadonlySet<string>
        occurredAt: string
      } & Pick<
        LiveSessionEncounterTurnCommitInput,
        'concentration' | 'concentrationEnds' | 'pendingConcentration'
      >
    ): Promise<{ actors: EncounterRunActorState[]; failed: boolean }>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readLiveEncounterTurnAdmission(ctx, input, input.command)
  if (admission.kind !== 'READY')
    return presentEncounterResultForMember(ctx, {
      campaign: admission.campaign,
      membership: admission.membership,
      result: admission.result
    })
  const { state, row: encounter, campaign, membership, resume } = admission
  const { root } = input
  const fingerprint = root.commandFingerprint
  const occurrenceVersion = admission.pending ? admission.pending.occurrence.version + 1 : 0
  if (
    root.commandType !== (resume?.root.commandType ?? admission.input.type) ||
    root.rootCommandId !== (resume?.root.rootCommandId ?? admission.input.commandId) ||
    root.commandFingerprint !== (resume?.root.commandFingerprint ?? admission.fingerprint) ||
    root.initiatorUserId !== campaign.ownerUserId ||
    root.requestedByUserId !== (resume?.root.requestedByUserId ?? input.expectedUserId) ||
    root.startSystemId !==
      (resume?.root.startSystemId ??
        (admission.input.type === 'START' ? (admission.input.systemId ?? null) : null)) ||
    root.correlationId !== null ||
    root.frozenActorRuleRevisionId !== null ||
    root.frozenActorRuleRevisionChecksum !== null ||
    root.frozenActorRuleSnapshotChecksum !== null ||
    checksumCanonicalJson(root.resolutionCommands) !==
      checksumCanonicalJson(resume?.root.resolutionCommands ?? []) ||
    (admission.pending !== null && input.occurrenceId !== admission.pending.occurrence.id) ||
    root.legendaryActionQueue !== undefined ||
    (root.commandType === 'ADVANCE_TURN' ? !root.outgoingTurn : root.outgoingTurn !== undefined)
  )
    throw new Error('Live Session terminal turn root mismatch.')
  const { rootCommand, initiative, original, durableActors, staged, advance } =
    await readNativeTurnSettlement({
      ctx,
      state,
      encounter,
      campaign,
      root
    })
  if (
    root.commandType === 'ADVANCE_TURN' &&
    (!advance ||
      !original ||
      original.round.policySnapshotChecksum !==
        (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum))
  )
    throw new Error('Live Session terminal initiative is stale.')
  const ruleActors = durableActors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session turn rule output scope mismatch.')
  // Outgoing effects, then Legendary Actions, then incoming effects, as the room planned them.
  const applications = nativeConcentrationDamageApplications([
    ...(root.outgoingTurn?.kind === 'STAGED' ? root.outgoingTurn.plan.executions : []),
    ...legendaryActionDamage(root.completedLegendaryActions),
    ...(input.incomingTurn.kind === 'STAGED' ? input.incomingTurn.plan.executions : [])
  ])
  if (
    input.maintenanceOwners.some(
      (request) =>
        !applications.some((application) => application.targetActorId === request.actorId)
    )
  )
    throw new Error('Live Session turn maintenance target mismatch.')
  await callbacks.validateReadFence(state, durableActors, input, input.maintenanceOwners)
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', input.occurrenceId))
    .unique()
  if (collision && collision._id !== admission.pending?.occurrence._id)
    throw new Error('Encounter rule occurrence ID was already used.')
  const effectCommit = {
    state,
    userId: input.expectedUserId,
    occurrenceId: input.occurrenceId,
    occurrenceVersion,
    rootCommandId: root.rootCommandId,
    occurredAt: input.occurredAt
  }
  const outgoing = root.outgoingTurn
    ? await persistEncounterTurnEffects(
        ctx,
        {
          ...effectCommit,
          boundary: { ordinal: 0, stage: 'END_OF_TURN', actorId: state.currentActorId },
          phase: root.outgoingTurn
        },
        callbacks.applyMechanics
      )
    : null
  await persistEncounterTurnResources(
    ctx,
    {
      state,
      root,
      occurrenceId: input.occurrenceId,
      occurredAt: input.occurredAt,
      userId: input.expectedUserId
    },
    {
      readDefinition: callbacks.readDefinition,
      applyMechanics: callbacks.applyMechanics
    }
  )
  if (staged)
    await initiative.persistStagedInitiativeRound(
      staged.stagedRoundState,
      root.commandType === 'ADVANCE_TURN' ? { replaceExistingRound: true } : undefined
    )
  if (advance && original) {
    if (advance.kind === 'ROUND_WRAP' && advance.cadence === 'ENCOUNTER_START')
      await correctInitiativeCursor({
        ctx,
        encounterId: state.id,
        sourceRound: state.round,
        targetRound: advance.nextRound,
        sourceCurrentActorId: state.currentActorId,
        currentActorId: advance.firstActorId
      })
    // The next turn skips actors defeated by the outgoing turn's effects and Legendary Actions,
    // which have just committed; the entering actor's refreshes leave hit points alone (D63).
    await applyEncounterInitiativeAdvance({
      repository: initiative,
      state: original,
      plan: advance,
      defeatedActorIds: skippedEncounterActorIds(await readRunActors(ctx, state))
    })
  }
  const incoming = await persistEncounterTurnEffects(
    ctx,
    {
      ...effectCommit,
      boundary: {
        ordinal: root.commandType === 'START' ? 0 : 1,
        stage: 'START_OF_TURN',
        actorId: root.proposedTerminalTransition.currentActorId
      },
      phase: input.incomingTurn
    },
    callbacks.applyMechanics
  )
  const nextState = encounterRunStateSchema.parse({
    ...state,
    ...root.proposedTerminalTransition,
    // START and ADVANCE_TURN always begin a new turn, even for the same actor.
    turnSequence: state.turnSequence + 1,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const characterIds = new Set(
    durableActors.flatMap((actor) =>
      actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
    )
  )
  for (const request of input.maintenanceOwners)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  const { actors } = await callbacks.persistConcentrationChildren({
    state: nextState,
    actors: await readRunActors(ctx, state),
    parentOccurrenceId: input.occurrenceId,
    parentCommandFingerprint: fingerprint,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
    remaining: await callbacks.bindConcentrationApplications(nextState, applications),
    correlationId: input.occurrenceId,
    userId: input.expectedUserId,
    authorizedCharacterIds: characterIds,
    occurredAt: input.occurredAt,
    concentration: input.concentration,
    concentrationEnds: input.concentrationEnds,
    pendingConcentration: input.pendingConcentration
  })
  const nextProjection = projectCurrentEncounterGm({
    state: nextState,
    actors,
    rules: input.rules,
    initiativeRoundState: await readEncounterInitiativeRound(ctx, {
      encounterId: state.id,
      round: nextState.round
    }),
    characterStates: await readEncounterCharacterStates(ctx, nextState, actors)
  })
  const occurrenceId =
    admission.pending?.occurrence._id ??
    (await ctx.db.insert(
      'encounterRuleOccurrences',
      encounterStoredRuleOccurrenceSchema.parse({
        id: input.occurrenceId,
        campaignId: campaign.id,
        encounterId: state.id,
        rootCommandId: root.rootCommandId,
        state: 'COMPLETED',
        version: occurrenceVersion,
        expectedEncounterVersion: nextState.version,
        pendingSnapshotChecksum: null,
        completedAt: input.occurredAt,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt
      })
    ))
  const occurrence = await ctx.db.get(occurrenceId)
  if (!occurrence) throw new Error('Encounter turn occurrence was not retained.')
  const result = await completeNativeInitiativeOccurrence({
    ctx,
    encounter,
    occurrence,
    state,
    nextState,
    nextProjection,
    rootCommand,
    rootCommandId: root.rootCommandId,
    rootCommandFingerprint: root.commandFingerprint,
    rootInitiatorUserId: root.initiatorUserId,
    rootRequestedByUserId: root.requestedByUserId,
    rootCorrelationId: root.correlationId,
    rootExpectedEncounterVersion: root.expectedEncounterVersion,
    initiative: root.initiative,
    initiativeAdvance: root.initiativeAdvance,
    rechargePlan: root.completedRechargePlan,
    outgoingEffects:
      root.outgoingTurn && outgoing
        ? { phase: root.outgoingTurn, result: outgoing.result }
        : undefined,
    incomingEffects: { phase: input.incomingTurn, result: incoming.result },
    legendaryActions: root.completedLegendaryActions,
    legendaryActionRefreshes: root.stagedLegendaryActionRefreshes,
    actionEconomyRefreshes: root.stagedActionEconomyRefreshes,
    includeOccurrence:
      occurrenceVersion > 0 ||
      root.completedRechargePlan != null ||
      (root.outgoingTurn !== undefined && root.outgoingTurn.kind !== 'NONE') ||
      input.incomingTurn.kind !== 'NONE' ||
      !!root.completedLegendaryActions?.length ||
      !!root.stagedLegendaryActionRefreshes?.length ||
      !!root.stagedActionEconomyRefreshes?.length,
    resolutionCommands: root.resolutionCommands,
    occurrenceVersion,
    encounterVersion: nextState.version,
    updatedAt: input.occurredAt
  })
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}
