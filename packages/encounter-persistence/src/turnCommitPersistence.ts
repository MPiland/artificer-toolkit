import type { LiveSessionEncounterTurnCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { type EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunStateSchema,
  type EncounterRunState,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  applyEncounterInitiativeAdvance,
  skippedActorIdsOfAdvance
} from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { skippedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  legendaryActionDamage,
  nativeConcentrationDamageApplications,
  zoneEffectDamage
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { recordZoneApplications, type CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type {
  ConcentrationDamageApplicationDto,
  concentrationMaintainedDamageApplicationDtoSchema,
  DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { readDeadCharacterIds } from './characterStates.js'
import { readRunActors } from './documents.js'
import { readNativeTurnSettlement } from './turnSettlement.js'
import { projectNativeGm } from './nativeProjection.js'
import { correctInitiativeCursor } from './initiativeCorrection.js'
import { completeNativeInitiativeOccurrence } from './initiativeTerminalCompletion.js'
import { readLiveEncounterTurnAdmission } from './turnCommandAdmission.js'
import {
  persistEncounterGrantTicks,
  persistEncounterIdleTurnCheck,
  type EncounterIdleTurnCharacterRules
} from './grantTickPersistence.js'
import { persistEncounterInitiativeRollCards } from './initiativeRollCards.js'
import {
  persistEncounterInitiativeRestores,
  type EncounterInitiativeRestoreCharacterRules
} from './initiativeRestorePersistence.js'
import { bindEncounterDamageSaveChain } from './effectRepeatSavePersistence.js'
import { markTurnStarted, readTurnStartedBy } from './turnMovement.js'
import { persistEncounterTurnEffects } from './turnEffectsPersistence.js'
import { persistEncounterTurnZoneEffects } from './turnZoneEffectsPersistence.js'
import {
  placeEncounterPassiveZones,
  type EncounterPassiveZoneReaders
} from './placedSpatialEffects.js'
import {
  persistEncounterTurnDeathSave,
  persistEncounterTurnResources
} from './turnResourcesPersistence.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'

/** Commits a DO-computed turn in one transaction, using the native normalized writes and receipts. */
export async function persistEncounterTurnCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
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
    readScene(sceneId: string): Promise<Pick<CampaignSceneState, 'grid' | 'tokens'>>
    readCharacterRules(
      ...args: Parameters<EncounterPassiveZoneReaders['readCharacterRules']>
    ): Promise<
      | (Awaited<ReturnType<EncounterPassiveZoneReaders['readCharacterRules']>> &
          EncounterInitiativeRestoreCharacterRules &
          EncounterIdleTurnCharacterRules)
      | null
    >
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
        remaining: readonly DamageSaveApplicationDto[]
        correlationId: string
        userId: string
        authorizedCharacterIds: ReadonlySet<string>
        occurredAt: string
        damagedActorIds: ReadonlySet<string>
      } & Pick<
        LiveSessionEncounterTurnCommitInput,
        'concentration' | 'concentrationEnds' | 'endedGrants' | 'pendingConcentration'
      >
    ): Promise<{ actors: EncounterRunActorState[]; mutated: boolean }>
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
  // Each boundary's effects, then its zones, around the Legendary Actions, as the room planned them.
  const damageBatches = [
    ...(root.outgoingTurn?.kind === 'STAGED' ? root.outgoingTurn.plan.executions : []),
    ...zoneEffectDamage(root.outgoingZoneTurn),
    ...legendaryActionDamage(root.completedLegendaryActions),
    ...(input.incomingTurn.kind === 'STAGED' ? input.incomingTurn.plan.executions : []),
    ...zoneEffectDamage(input.incomingZoneTurn)
  ]
  const applications = nativeConcentrationDamageApplications(damageBatches)
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
  const zoneCommit = {
    state,
    occurrenceId: input.occurrenceId,
    rootCommandId: root.rootCommandId,
    commandType: root.commandType,
    occurredAt: input.occurredAt
  }
  const zoneCallbacks = {
    applyMechanics: callbacks.applyMechanics,
    readSceneTokens: async (sceneId: string) => (await callbacks.readScene(sceneId)).tokens
  }
  const outgoingZones = await persistEncounterTurnZoneEffects(
    ctx,
    {
      ...zoneCommit,
      boundary: { ordinal: 0, stage: 'END_OF_TURN', actorId: state.currentActorId },
      plan: root.outgoingZoneTurn
    },
    zoneCallbacks
  )
  await persistEncounterGrantTicks(ctx, {
    state,
    stage: 'END_OF_TURN',
    turnActorId: state.currentActorId,
    occurredAt: input.occurredAt
  })
  await persistEncounterTurnResources(
    ctx,
    {
      state,
      campaign,
      root,
      occurrenceId: input.occurrenceId,
      occurredAt: input.occurredAt,
      userId: input.expectedUserId
    },
    {
      readDefinition: callbacks.readDefinition,
      applyMechanics: callbacks.applyMechanics,
      readSceneTokens: zoneCallbacks.readSceneTokens
    }
  )
  // After the Legendary Actions: the damage they deal at this turn's end counts as taken.
  await persistEncounterIdleTurnCheck(
    ctx,
    { state, campaign, turnActorId: state.currentActorId, occurredAt: input.occurredAt },
    callbacks.readCharacterRules
  )
  await persistEncounterInitiativeRollCards(ctx, {
    state,
    campaign,
    actors: durableActors,
    root,
    occurrenceId: input.occurrenceId,
    occurredAt: input.occurredAt
  })
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
    const committedActors = await readRunActors(ctx, state)
    await applyEncounterInitiativeAdvance({
      repository: initiative,
      state: original,
      plan: advance,
      defeatedActorIds: skippedEncounterActorIds(
        committedActors,
        await readDeadCharacterIds(ctx, committedActors)
      )
    })
  }
  // A skipped turn still passes in its place in the initiative order, so grants anchored to its
  // actor count both of its boundaries.
  const openerId = root.proposedTerminalTransition.currentActorId
  for (const turnActorId of [
    ...(advance && original ? skippedActorIdsOfAdvance({ state: original, plan: advance }) : []),
    ...(root.initiative && openerId !== null
      ? root.initiative.orderedActorIds.slice(
          0,
          Math.max(0, root.initiative.orderedActorIds.indexOf(openerId))
        )
      : [])
  ])
    for (const stage of ['START_OF_TURN', 'END_OF_TURN'] as const)
      await persistEncounterGrantTicks(ctx, {
        state,
        stage,
        turnActorId,
        occurredAt: input.occurredAt
      })
  await persistEncounterTurnDeathSave(
    ctx,
    { state, campaign, root, occurrenceId: input.occurrenceId, occurredAt: input.occurredAt },
    callbacks.applyMechanics
  )
  const incomingBoundary = {
    ordinal: root.commandType === 'START' ? 0 : 1,
    stage: 'START_OF_TURN',
    actorId: root.proposedTerminalTransition.currentActorId
  } as const
  // A turn that was already begun (Previous Turn, then Next) never runs its start-of-turn effects again.
  const incomingBegun =
    incomingBoundary.actorId !== null &&
    (await readTurnStartedBy(ctx, {
      encounterId: state.id,
      round: root.proposedTerminalTransition.round,
      actorId: incomingBoundary.actorId
    })) !== null
  const incoming = incomingBegun
    ? { result: null, actors: [] }
    : await persistEncounterTurnEffects(
        ctx,
        {
          ...effectCommit,
          boundary: incomingBoundary,
          phase: input.incomingTurn
        },
        callbacks.applyMechanics
      )
  // Passive zones are in place from the Encounter's start, before any first turn (D144, D155).
  if (root.commandType === 'START')
    await placeEncounterPassiveZones(
      ctx,
      {
        state,
        campaign,
        actors: durableActors,
        occurrenceId: input.occurrenceId,
        rootCommandId: root.rootCommandId
      },
      callbacks
    )
  const incomingZones = incomingBegun
    ? null
    : await persistEncounterTurnZoneEffects(
        ctx,
        { ...zoneCommit, boundary: incomingBoundary, plan: input.incomingZoneTurn },
        zoneCallbacks
      )
  if (!incomingBegun)
    await persistEncounterGrantTicks(ctx, {
      state,
      stage: 'START_OF_TURN',
      turnActorId: root.proposedTerminalTransition.currentActorId,
      occurredAt: input.occurredAt
    })
  // After every stage that plans against a Character's stream version: the raise advances it.
  if (root.initiative)
    await persistEncounterInitiativeRestores(
      ctx,
      {
        state,
        campaign,
        actors: durableActors,
        orderedActorIds: root.initiative.orderedActorIds,
        rootCommandId: root.rootCommandId,
        occurrenceId: input.occurrenceId,
        occurredAt: input.occurredAt
      },
      callbacks
    )
  const nextState = encounterRunStateSchema.parse({
    ...state,
    ...root.proposedTerminalTransition,
    // START and ADVANCE_TURN always begin a new turn, even for the same actor.
    turnSequence: state.turnSequence + 1,
    // Only the new turn's catches count: the outgoing turn is over, so its limit is never read again.
    ...(incomingZones
      ? {
          zoneApplications: recordZoneApplications(
            state.zoneApplications,
            state.turnSequence + 1,
            incomingZones.phase.executions.map(({ candidate }) => candidate.candidate)
          )
        }
      : {}),
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  await markTurnStarted(ctx, { state: nextState, commandId: root.rootCommandId })
  const characterIds = new Set(
    durableActors.flatMap((actor) =>
      actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
    )
  )
  for (const request of input.maintenanceOwners)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  const settledActors = await readRunActors(ctx, state)
  const { actors } = await callbacks.persistConcentrationChildren({
    state: nextState,
    actors: settledActors,
    parentOccurrenceId: input.occurrenceId,
    parentCommandFingerprint: fingerprint,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
    remaining: await bindEncounterDamageSaveChain(ctx, {
      concentration: await callbacks.bindConcentrationApplications(nextState, applications),
      state: nextState,
      actors: settledActors,
      applications,
      parentOccurrenceId: input.occurrenceId,
      damagerActorId: null
    }),
    correlationId: input.occurrenceId,
    userId: input.expectedUserId,
    authorizedCharacterIds: characterIds,
    occurredAt: input.occurredAt,
    damagedActorIds: new Set(applications.map(({ targetActorId }) => targetActorId)),
    concentration: input.concentration,
    concentrationEnds: input.concentrationEnds,
    endedGrants: input.endedGrants,
    pendingConcentration: input.pendingConcentration
  })
  const nextProjection = await projectNativeGm(ctx, nextState, actors, input.rules)
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
    deathSavePlan: root.completedDeathSavePlan,
    outgoingEffects:
      root.outgoingTurn && outgoing
        ? { phase: root.outgoingTurn, result: outgoing.result }
        : undefined,
    incomingEffects: { phase: input.incomingTurn, result: incoming.result },
    outgoingZones: outgoingZones?.phase,
    incomingZones: incomingZones?.phase,
    legendaryActions: root.completedLegendaryActions,
    legendaryActionRefreshes: root.stagedLegendaryActionRefreshes,
    actionEconomyRefreshes: root.stagedActionEconomyRefreshes,
    includeOccurrence:
      occurrenceVersion > 0 ||
      root.completedRechargePlan != null ||
      root.completedDeathSavePlan != null ||
      (root.outgoingTurn !== undefined && root.outgoingTurn.kind !== 'NONE') ||
      input.incomingTurn.kind !== 'NONE' ||
      !!outgoingZones ||
      !!incomingZones ||
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
