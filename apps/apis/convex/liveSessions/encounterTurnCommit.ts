import { v } from 'convex/values'
import { liveSessionEncounterTurnCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { type EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { applyEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { defeatedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  legendaryActionDamage,
  nativeConcentrationDamageApplications
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internalMutation } from '../lib/mutations'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'
import { readEncounterCharacterStates } from '../encounters/characterStates'
import { readRunActors } from '../encounters/documents'
import { readNativeTurnSettlement } from '../encounters/turnSettlement'
import { readEncounterInitiativeRound } from '../encounters/initiativeStore'
import { correctInitiativeCursor } from '../encounters/initiativeCorrection'
import { completeNativeInitiativeOccurrence } from '../encounters/initiativeTerminalCompletion'
import { readLiveEncounterTurnAdmission, assertLiveTurnRevisions } from './encounterTurnAdmission'
import { persistLiveTurnEffects } from './encounterTurnEffectsCommit'
import { persistLiveTurnResources } from './encounterTurnResourcesCommit'
import {
  bindLiveConcentrationApplications,
  persistLiveEncounterConcentrationChildren
} from './encounterConcentrationChildrenCommit'

/** Commits a DO-computed turn in one transaction, using the native normalized writes and receipts. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterTurnCommitInputSchema.parse(args)
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
      await readNativeTurnSettlement({ ctx, state, encounter, campaign, root })
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
      input.rules.actors.some(
        (actor) => !ruleActors.some((current) => current.id === actor.actorId)
      )
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
    await assertLiveTurnRevisions(ctx, state, durableActors, input, input.maintenanceOwners)
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
      ? await persistLiveTurnEffects(ctx, {
          ...effectCommit,
          boundary: { ordinal: 0, stage: 'END_OF_TURN', actorId: state.currentActorId },
          phase: root.outgoingTurn
        })
      : null
    await persistLiveTurnResources(ctx, {
      state,
      root,
      occurrenceId: input.occurrenceId,
      occurredAt: input.occurredAt,
      userId: input.expectedUserId
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
      await applyEncounterInitiativeAdvance({
        repository: initiative,
        state: original,
        plan: advance,
        defeatedActorIds: defeatedEncounterActorIds(await readRunActors(ctx, state))
      })
    }
    const incoming = await persistLiveTurnEffects(ctx, {
      ...effectCommit,
      boundary: {
        ordinal: root.commandType === 'START' ? 0 : 1,
        stage: 'START_OF_TURN',
        actorId: root.proposedTerminalTransition.currentActorId
      },
      phase: input.incomingTurn
    })
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
    const { actors } = await persistLiveEncounterConcentrationChildren(ctx, {
      state: nextState,
      actors: await readRunActors(ctx, state),
      parentOccurrenceId: input.occurrenceId,
      parentCommandFingerprint: fingerprint,
      finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
      remaining: await bindLiveConcentrationApplications(ctx, nextState, applications),
      correlationId: input.occurrenceId,
      userId: input.expectedUserId,
      authorizedCharacterIds: characterIds,
      occurredAt: input.occurredAt,
      concentration: input.concentration,
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
          pendingSnapshotJson: null,
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
    return presentEncounterResultForMember(ctx, { campaign, membership, result })
  }
})
