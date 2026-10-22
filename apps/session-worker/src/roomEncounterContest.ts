import {
  persistEncounterContestPending,
  persistEncounterContestCommit
} from '@artificer-toolkit/encounter-persistence/contestPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { applyRoomForcedMovements } from './roomActionForcedMovement.js'
import { planNativeLiveContest, type planNativeLiveContestRolls } from './nativeContest.js'
import type { MovementSettlementContext } from './roomMovementSettlementCallbacks.js'
import { roomLiveCaptureReads } from './roomLiveCaptureReads.js'
import { assertRoomEncounterRulesRevisions } from './roomEncounterTurns.js'
import { readRoomActionSceneInputs } from './roomActionSceneInputs.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** The sealed contest, item transition, action economy and receipts use the same native commit. */
export async function executeRoomEncounterContest(input: {
  ctx: Parameters<typeof persistEncounterContestCommit>[0] & MovementSettlementContext
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto
  runtime: RulesRuntimeService
  random(maximum: number): number
}) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const plan = await planNativeLiveContest(scope, input.command, {
    runtime: input.runtime,
    random: input.random,
    captures: roomLiveCaptureReads({ ctx, store, transaction, inputs, observed })
  })
  if (plan.kind === 'REPLAY') return plan.result
  return persistRoomEncounterContest({
    ctx,
    store,
    transaction,
    inputs,
    scope,
    observed,
    runtime: input.runtime,
    random: input.random,
    plan
  })
}

/**
 * Stores a room-planned contest: the paused contest waiting on a participant, or its settled
 * outcome. A Disarm and a basic action contest the ordinary action planner starts share it.
 */
export async function persistRoomEncounterContest(input: {
  ctx: Parameters<typeof persistEncounterContestCommit>[0] & MovementSettlementContext
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  runtime: RulesRuntimeService
  random(maximum: number): number
  plan: Awaited<ReturnType<typeof planNativeLiveContestRolls>>
}) {
  const { ctx, store, transaction, inputs, scope, observed, plan } = input
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', scope.encounterId))
    .unique()
  if (!run) throw new Error('Room contest Run is unavailable.')
  const ids = new Set(
    (await readRunActors(ctx, readRunState(run))).flatMap((actor) =>
      actor.kind === 'CHARACTER' ? [actor.sourceId] : []
    )
  )
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  const callbacks: Parameters<typeof persistEncounterContestCommit>[2] = {
    readActionSceneInputs: (state, command) =>
      readRoomActionSceneInputs(ctx, transaction, state, command),
    validateReadFence: async (state, characterIds, revisions) =>
      assertRoomEncounterRulesRevisions(observed, state, characterIds, revisions),
    applyMechanics: (batch) =>
      applyRoomEncounterMechanicsBatch({
        ctx,
        store,
        transaction,
        inputs,
        campaignId: scope.campaignId,
        epoch: scope.authorityEpoch,
        observed,
        batch
      }),
    applyForcedMovements: (movement) =>
      applyRoomForcedMovements({
        ctx,
        transaction,
        store,
        inputs,
        scope,
        observed,
        captures: roomLiveCaptureReads({ ctx, store, transaction, inputs, observed }),
        runtime: input.runtime,
        random: input.random,
        userId: scope.expectedUserId,
        movement
      })
  }
  return plan.kind === 'PENDING'
    ? persistEncounterContestPending(ctx, { ...plan.input, revisions }, callbacks)
    : persistEncounterContestCommit(ctx, { ...plan.input, revisions }, callbacks)
}
