import {
  persistEncounterBasicActionResponse,
  persistEncounterCheckD20WindowOpen,
  persistEncounterEscapeResponse
} from '@artificer-toolkit/encounter-persistence/basicActionCheckResponsePersistence'
import { persistEncounterBasicAction } from '@artificer-toolkit/encounter-persistence/basicActionPersistence'
import {
  persistEncounterCheckActionPause,
  persistEncounterCheckActionResponse
} from '@artificer-toolkit/encounter-persistence/checkActionResponsePersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { persistEncounterEndHeldGrant } from '@artificer-toolkit/encounter-persistence/endHeldGrantPersistence'
import { persistEncounterMoveHeldEffect } from '@artificer-toolkit/encounter-persistence/moveHeldEffectPersistence'
import { persistEncounterChangeFacing } from '@artificer-toolkit/encounter-persistence/changeFacingPersistence'
import { persistEncounterEscape } from '@artificer-toolkit/encounter-persistence/escapePersistence'
import { persistEncounterReleaseRelationship } from '@artificer-toolkit/encounter-persistence/releaseRelationshipPersistence'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  ChangeFacingInputDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ReleaseRelationshipInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterBasicActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { planNativeLiveBasicActionResponse } from './nativeBasicActionResponse.js'
import { planNativeLiveEndHeldGrant } from './nativeEndHeldGrantAction.js'
import { planNativeLiveEscape } from './nativeEscapeAction.js'
import { planNativeLiveEscapeResponse } from './nativeEscapeActionResponse.js'
import { planNativeLiveMoveHeldEffect } from './nativeMoveHeldEffectAction.js'
import { planNativeLiveChangeFacing } from './nativeChangeFacingAction.js'
import { setRoomActorFacing } from './roomActionFacing.js'
import { planNativeLiveReleaseRelationship } from './nativeReleaseRelationshipAction.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { applyRoomForcedMovements, readRoomForcedMovementPick } from './roomActionForcedMovement.js'
import {
  assertRoomEncounterReadFence,
  assertRoomEncounterRulesRevisions
} from './roomEncounterTurns.js'
import { persistRoomEncounterContest } from './roomEncounterContest.js'
import type { MovementSettlementContext } from './roomMovementSettlementCallbacks.js'
import { roomLiveCaptureReads } from './roomLiveCaptureReads.js'
import { readRoomBoundSceneTokens } from './roomRelationshipEnds.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

type RoomBasicActionInput = {
  ctx: EncounterWriteTransaction & MovementSettlementContext
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  runtime: RulesRuntimeService
  random(maximum: number): number
}

function basicActionExecution(input: RoomBasicActionInput) {
  const { ctx, store, transaction, inputs, observed } = input
  return {
    runtime: input.runtime,
    random: input.random,
    captures: roomLiveCaptureReads({ ctx, store, transaction, inputs, observed })
  }
}

/** How a check action's won outcome lands: its mechanics batch and its pushes on the Scene (D157). */
function actionOutcomeCallbacks(input: RoomBasicActionInput) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  return {
    applyMechanics: (batch: Parameters<typeof applyRoomEncounterMechanicsBatch>[0]['batch']) =>
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
    applyForcedMovements: (movement: Parameters<typeof applyRoomForcedMovements>[0]['movement']) =>
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
}

/** The Characters a basic action's Run holds, whose revisions its commit is fenced on. */
async function readBasicActionRevisions(input: RoomBasicActionInput) {
  const { ctx, scope, observed } = input
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', scope.encounterId))
    .unique()
  if (!run) throw new Error('Room basic action Run is unavailable.')
  const ids = new Set(
    (await readRunActors(ctx, readRunState(run))).flatMap((actor) =>
      actor.kind === 'CHARACTER' ? [actor.sourceId] : []
    )
  )
  return observed.filter((revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id))
}

/** A planned CHECK action spends its allowance and pends or settles its check in one native commit. */
export async function persistRoomEncounterCheckAction(
  input: RoomBasicActionInput & { planned: LiveSessionEncounterBasicActionCommitInput }
) {
  const { ctx, transaction, inputs, scope, observed, planned } = input
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, planned.revisions)
  return persistEncounterBasicAction(
    ctx,
    { ...planned, revisions },
    {
      validateReadFence: (state, actors, fence) =>
        assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, {
          revisions: fence.revisions,
          scenes: []
        }),
      readDefinition: async (id, userId) => {
        await ctx.ports.requireCampaignAuthority(scope.campaignId, userId)
        const source = await inputs.definition(id, observed, transaction)
        return source.sourceKind === 'PLATFORM' ? source.definition : null
      },
      ...actionOutcomeCallbacks(input)
    }
  )
}

/** An Escape spends its activation and pends or settles the holder's check in one native commit. */
export async function executeRoomEncounterEscape(
  input: RoomBasicActionInput & { command: EscapeRelationshipInputDto }
) {
  const { ctx, transaction, scope, observed } = input
  const plan = await planNativeLiveEscape(scope, input.command, {
    ...basicActionExecution(input),
    // A rescuer's reach to the held creature reads the Run's bound Scene, as a relationship end does.
    readReachScene: (state) => readRoomBoundSceneTokens(ctx, transaction, state),
    forcedMovementPick: (pick) => readRoomForcedMovementPick({ ctx, transaction, ...pick })
  })
  if (plan.kind === 'REPLAY') return plan.result
  if (plan.kind === 'CONTEST') return persistRoomEncounterContest({ ...input, plan: plan.contest })
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterEscape(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: (state, actors, fence) =>
        assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, {
          revisions: fence.revisions,
          scenes: []
        })
    }
  )
}

/** Ending a held grant spends its activation and deletes the grant in one native commit. */
export async function executeRoomEncounterEndHeldGrant(
  input: RoomBasicActionInput & { command: EndHeldGrantInputDto }
) {
  const { ctx, transaction, scope, observed } = input
  const plan = await planNativeLiveEndHeldGrant(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterEndHeldGrant(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: (state, actors, fence) =>
        assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, {
          revisions: fence.revisions,
          scenes: []
        })
    }
  )
}

/** Moving a held effect spends its offer's activation and re-creates the effect under its new holder in one native commit. */
export async function executeRoomEncounterMoveHeldEffect(
  input: RoomBasicActionInput & { command: MoveHeldEffectInputDto }
) {
  const { ctx, transaction, scope, observed } = input
  const plan = await planNativeLiveMoveHeldEffect(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterMoveHeldEffect(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: (state, actors, fence) =>
        assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, {
          revisions: fence.revisions,
          scenes: []
        })
    }
  )
}

/** A creature's Change facing reaction turns its token and spends its reaction in one native commit (ATTACK-12). */
export async function executeRoomEncounterChangeFacing(
  input: RoomBasicActionInput & { command: ChangeFacingInputDto }
) {
  const { ctx, transaction, scope, observed } = input
  const plan = await planNativeLiveChangeFacing(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterChangeFacing(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: (state, actors, fence) =>
        assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, {
          revisions: fence.revisions,
          scenes: []
        }),
      setActorFacing: ({ encounterId, commandId, actorId, rotationDegrees }) =>
        setRoomActorFacing({
          ctx,
          transaction,
          userId: scope.expectedUserId,
          actorId,
          rotationDegrees,
          origin: { encounterId, commandId }
        })
    }
  )
}

/** A source's free release ends the relationship and the conditions it held in one native commit. */
export async function executeRoomEncounterReleaseRelationship(
  input: RoomBasicActionInput & { command: ReleaseRelationshipInputDto }
) {
  const { ctx, transaction, scope, observed } = input
  const plan = await planNativeLiveReleaseRelationship(
    scope,
    input.command,
    basicActionExecution(input)
  )
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterReleaseRelationship(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: (state, actors, fence) =>
        assertRoomEncounterReadFence(ctx, transaction, observed, state, actors, {
          revisions: fence.revisions,
          scenes: []
        })
    }
  )
}

/** The holder's d20 settles a pending Escape check and frees them in one native commit. */
export async function executeRoomEncounterEscapeResponse(
  input: RoomBasicActionInput & { command: ResolveRuleOccurrenceInputDto }
) {
  const { ctx, scope, observed } = input
  const plan = await planNativeLiveEscapeResponse(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  const validateReadFence = roomCheckReadFence(observed)
  if (plan.kind === 'D20_WINDOW_PAUSE')
    return persistEncounterCheckD20WindowOpen(
      ctx,
      { ...plan.input, revisions },
      { check: 'ESCAPE_CHECK', validateReadFence }
    )
  return persistEncounterEscapeResponse(ctx, { ...plan.input, revisions }, { validateReadFence })
}

/** A d20 or outcome answer settles or pauses a pending check action (D173) or concealment check in one native commit. */
export async function executeRoomEncounterBasicActionResponse(
  input: RoomBasicActionInput & { command: ResolveRuleOccurrenceInputDto }
) {
  const { ctx, scope, observed } = input
  const plan = await planNativeLiveBasicActionResponse(
    scope,
    input.command,
    basicActionExecution(input)
  )
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  const validateReadFence = roomCheckReadFence(observed)
  if (plan.kind === 'D20_WINDOW_PAUSE')
    return persistEncounterCheckD20WindowOpen(
      ctx,
      { ...plan.input, revisions },
      { check: 'CONCEALMENT_CHECK', validateReadFence }
    )
  if (plan.kind === 'CHECK_ACTION_PAUSE')
    return persistEncounterCheckActionPause(
      ctx,
      { ...plan.input, revisions },
      { validateReadFence }
    )
  const callbacks = { validateReadFence, ...actionOutcomeCallbacks(input) }
  if (plan.kind === 'CHECK_ACTION_SETTLED')
    return persistEncounterCheckActionResponse(ctx, { ...plan.input, revisions }, callbacks)
  return persistEncounterBasicActionResponse(ctx, { ...plan.input, revisions }, callbacks)
}

/** A pending check's commit checks the Run and Sheet revisions its plan read, as the room observed them. */
function roomCheckReadFence(observed: RoomBasicActionInput['observed']) {
  return async (
    state: Parameters<typeof assertRoomEncounterRulesRevisions>[1],
    characterIds: Parameters<typeof assertRoomEncounterRulesRevisions>[2],
    fence: Parameters<typeof assertRoomEncounterRulesRevisions>[3]
  ) => assertRoomEncounterRulesRevisions(observed, state, characterIds, fence)
}
