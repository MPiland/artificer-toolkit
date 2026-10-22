import { persistEncounterActionPending } from '@artificer-toolkit/encounter-persistence/actionPendingPersistence'
import { persistEncounterActionCommit } from '@artificer-toolkit/encounter-persistence/actionCommitPersistence'
import { readActorFormCreature } from '@artificer-toolkit/encounter-persistence/actorFormPersistence'
import { persistEncounterAreaCommit } from '@artificer-toolkit/encounter-persistence/areaCommitPersistence'
import { persistEncounterCounteredCastCommit } from '@artificer-toolkit/encounter-persistence/counteredCastCommitPersistence'
import { persistEncounterGatedActionCommit } from '@artificer-toolkit/encounter-persistence/gatedActionCommitPersistence'
import {
  prepareEncounterActionMaintenance,
  persistEncounterActionEffects
} from '@artificer-toolkit/encounter-persistence/actionEffectPersistence'
import { persistEncounterActionChildren } from '@artificer-toolkit/encounter-persistence/actionChildrenPersistence'
import { bindEncounterConcentrationApplications } from '@artificer-toolkit/encounter-persistence/concentrationChildrenPersistence'
import { readCharacterMaximumHitPoints } from '@artificer-toolkit/encounter-persistence/characterMaximumHitPoints'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  RemoveAreaTargetInputDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  planNativeLiveEncounterAction,
  buildNativeLiveEncounterActionPendingInput,
  buildNativeLiveEncounterActionCommitInput
} from './nativeEncounterRules.js'
import { buildNativeLiveEncounterCounteredCastCommitInput } from './nativeEncounterCastReaction.js'
import { buildNativeLiveEncounterGatedActionCommitInput } from './nativeEncounterIncomingGate.js'
import { persistRoomEncounterCheckAction } from './roomEncounterBasicActions.js'
import { persistRoomEncounterContest } from './roomEncounterContest.js'
import type { MovementSettlementContext } from './roomMovementSettlementCallbacks.js'
import { roomLiveCaptureReads } from './roomLiveCaptureReads.js'
import { assertRoomEncounterRulesRevisions } from './roomEncounterTurns.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { buildNativeLiveEncounterAreaActionPendingInput } from './nativeEncounterAreaRules.js'
import { buildNativeLiveEncounterAreaCommitInput } from './nativeAreaCommit.js'
import {
  readRoomActionAreaSceneInputs,
  readRoomActionSceneInputs
} from './roomActionSceneInputs.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { applyRoomForcedMovements, readRoomForcedMovementPick } from './roomActionForcedMovement.js'
import { persistRoomConcentrationChildren } from './roomConcentrationPersistence.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** The existing action planner, evidence and every dependent write use one native transaction. */
export async function executeRoomEncounterAction(input: {
  ctx: EncounterWriteTransaction &
    Parameters<typeof persistRoomConcentrationChildren>[0] &
    MovementSettlementContext
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  command: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto | RemoveAreaTargetInputDto
  runtime: RulesRuntimeService
  random(maximum: number): number
}) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const captures: LiveCaptureReads = {
    ...roomLiveCaptureReads({ ctx, store, transaction, inputs, observed }),
    readFormCreature: (gameSystemId, creatureId) =>
      readActorFormCreature(ctx.ports, {
        campaignId: scope.campaignId,
        userId: scope.expectedUserId,
        gameSystemId,
        creatureId
      })
  }
  const plan = await planNativeLiveEncounterAction(scope, input.command, {
    runtime: input.runtime,
    random: input.random,
    captures,
    forcedMovementPick: (pick) => readRoomForcedMovementPick({ ctx, transaction, ...pick })
  })
  if (plan.kind === 'REPLAY') return plan.result
  // A basic action contested by its target (Grapple) settles through the one contest commit (D152).
  if (plan.kind === 'CONTEST')
    return persistRoomEncounterContest({
      ctx,
      store,
      transaction,
      inputs,
      scope,
      observed,
      runtime: input.runtime,
      random: input.random,
      plan: plan.plan
    })
  if (plan.kind === 'CHECK')
    return persistRoomEncounterCheckAction({
      ctx,
      store,
      transaction,
      inputs,
      scope,
      observed,
      runtime: input.runtime,
      random: input.random,
      planned: plan.input
    })
  const captured =
    plan.kind === 'AREA_PENDING'
      ? buildNativeLiveEncounterAreaActionPendingInput(scope, plan)
      : plan.kind === 'AREA_COMMIT'
        ? buildNativeLiveEncounterAreaCommitInput(scope, plan)
        : plan.kind === 'PENDING' ||
            plan.kind === 'CAST_PENDING' ||
            plan.kind === 'GATE_PENDING' ||
            plan.kind === 'RETARGET_PENDING'
          ? buildNativeLiveEncounterActionPendingInput(scope, plan)
          : plan.kind === 'COUNTERED'
            ? buildNativeLiveEncounterCounteredCastCommitInput(scope, plan)
            : plan.kind === 'GATED'
              ? buildNativeLiveEncounterGatedActionCommitInput(scope, plan)
              : buildNativeLiveEncounterActionCommitInput(scope, plan)
  const ids = new Set(
    plan.prepared.actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  for (const request of 'maintenanceOwners' in captured ? captured.maintenanceOwners : [])
    if (request.owner.kind === 'CHARACTER') ids.add(request.owner.characterId)
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
  mergeNativeRulesRevisions(revisions, captured.revisions)
  const callbacks: Parameters<typeof persistEncounterActionCommit>[2] &
    Parameters<typeof persistEncounterActionPending>[2] = {
    readMaintenanceCapture: (state, request) => readRoomMaintenanceCapture(ctx, state, request),
    readActionSceneInputs: (state, command) =>
      readRoomActionSceneInputs(ctx, transaction, state, command),
    readAreaSceneInputs: (state, command) =>
      readRoomActionAreaSceneInputs(ctx, transaction, state, command),
    validateReadFence: async (state, characterIds, revisions) =>
      assertRoomEncounterRulesRevisions(observed, state, characterIds, revisions),
    currentCharacterMaximumHitPoints: async (state, id) => {
      const row = await ctx.ports.readCharacterRow(id)
      if (!row || row.status !== 'ACTIVE' || row.systemId !== state.gameSystemId)
        throw new Error('Room action Character changed.')
      return readCharacterMaximumHitPoints(ctx, row.play)
    },
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
        captures,
        runtime: input.runtime,
        random: input.random,
        userId: scope.expectedUserId,
        movement
      }),
    prepareActionMaintenance: (maintenance) => prepareEncounterActionMaintenance(ctx, maintenance),
    persistActionEffects: (effects) => persistEncounterActionEffects(ctx, effects),
    persistActionChildren: (children) =>
      persistEncounterActionChildren(ctx, children, {
        bindConcentrationApplications: (state, applications) =>
          bindEncounterConcentrationApplications(ctx, state, applications),
        persistConcentrationChildren: (children) => persistRoomConcentrationChildren(ctx, children)
      })
  }
  if (plan.kind === 'AREA_PENDING')
    return persistEncounterActionPending(
      ctx,
      {
        ...buildNativeLiveEncounterAreaActionPendingInput(scope, plan),
        revisions
      },
      callbacks
    )
  if (plan.kind === 'AREA_COMMIT')
    return persistEncounterAreaCommit(
      ctx,
      { ...buildNativeLiveEncounterAreaCommitInput(scope, plan), revisions },
      {
        ...callbacks,
        bindConcentrationApplications: (state, applications) =>
          bindEncounterConcentrationApplications(ctx, state, applications),
        persistConcentrationChildren: (children) => persistRoomConcentrationChildren(ctx, children)
      }
    )
  if (plan.kind === 'COUNTERED')
    return persistEncounterCounteredCastCommit(
      ctx,
      { ...buildNativeLiveEncounterCounteredCastCommitInput(scope, plan), revisions },
      callbacks
    )
  if (plan.kind === 'GATED')
    return persistEncounterGatedActionCommit(
      ctx,
      { ...buildNativeLiveEncounterGatedActionCommitInput(scope, plan), revisions },
      callbacks
    )
  return plan.kind === 'PENDING' ||
    plan.kind === 'CAST_PENDING' ||
    plan.kind === 'GATE_PENDING' ||
    plan.kind === 'RETARGET_PENDING'
    ? persistEncounterActionPending(
        ctx,
        {
          ...buildNativeLiveEncounterActionPendingInput(scope, plan),
          revisions
        },
        callbacks
      )
    : persistEncounterActionCommit(
        ctx,
        {
          ...buildNativeLiveEncounterActionCommitInput(scope, plan),
          revisions
        },
        callbacks
      )
}
