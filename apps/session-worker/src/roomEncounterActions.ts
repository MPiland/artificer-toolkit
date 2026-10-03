import { persistEncounterActionPending } from '@artificer-toolkit/encounter-persistence/actionPendingPersistence'
import { persistEncounterActionCommit } from '@artificer-toolkit/encounter-persistence/actionCommitPersistence'
import {
  prepareEncounterActionMaintenance,
  persistEncounterActionEffects
} from '@artificer-toolkit/encounter-persistence/actionEffectPersistence'
import { persistEncounterActionChildren } from '@artificer-toolkit/encounter-persistence/actionChildrenPersistence'
import { bindEncounterConcentrationApplications } from '@artificer-toolkit/encounter-persistence/concentrationChildrenPersistence'
import { readCharacterMaximumHitPoints } from '@artificer-toolkit/encounter-persistence/characterMaximumHitPoints'
import type {
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
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { assertRoomEncounterRulesRevisions } from './roomEncounterTurns.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { readRoomActionSceneInputs } from './roomActionSceneInputs.js'
import { readRoomSceneHeader, readRoomSceneEntities } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { persistRoomConcentrationChildren } from './roomConcentrationPersistence.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** The existing action planner, evidence and every dependent write use one native transaction. */
export async function executeRoomEncounterAction(input: {
  ctx: Parameters<typeof persistEncounterActionCommit>[0] &
    Parameters<typeof persistRoomConcentrationChildren>[0]
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
  const plan = await planNativeLiveEncounterAction(scope, input.command, {
    runtime: input.runtime,
    random: input.random,
    captures: {
      encounterRules: (request) =>
        readRoomEncounterTurnCapture(
          ctx,
          inputs,
          transaction,
          request,
          observed.filter((revision) => revision.scope !== 'CHARACTER'),
          {
            readSceneHeader: async (sceneId) => readRoomSceneHeader(transaction, sceneId),
            readSceneEntities: (page) => readRoomSceneEntities(transaction, page)
          }
        ),
      prepareCharacter: (characterScope) =>
        prepareRoomLiveCharacterSheet(store, inputs, characterScope, observed, transaction)
    }
  })
  if (plan.kind === 'REPLAY') return plan.result
  const captured =
    plan.kind === 'PENDING'
      ? buildNativeLiveEncounterActionPendingInput(scope, plan)
      : buildNativeLiveEncounterActionCommitInput(scope, plan)
  const ids = new Set(
    plan.prepared.actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  for (const request of captured.maintenanceOwners)
    if (request.owner.kind === 'CHARACTER') ids.add(request.owner.characterId)
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
  mergeNativeRulesRevisions(revisions, captured.revisions)
  const callbacks: Parameters<typeof persistEncounterActionCommit>[2] = {
    readMaintenanceCapture: (state, request) => readRoomMaintenanceCapture(ctx, state, request),
    readActionSceneInputs: (state, command) =>
      readRoomActionSceneInputs(ctx, transaction, state, command),
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
    prepareActionMaintenance: (maintenance) => prepareEncounterActionMaintenance(ctx, maintenance),
    persistActionEffects: (effects) => persistEncounterActionEffects(ctx, effects),
    persistActionChildren: (children) =>
      persistEncounterActionChildren(ctx, children, {
        bindConcentrationApplications: (state, applications) =>
          bindEncounterConcentrationApplications(ctx, state, applications),
        persistConcentrationChildren: (children) => persistRoomConcentrationChildren(ctx, children)
      })
  }
  return plan.kind === 'PENDING'
    ? persistEncounterActionPending(
        ctx,
        { ...buildNativeLiveEncounterActionPendingInput(scope, plan), revisions },
        callbacks
      )
    : persistEncounterActionCommit(
        ctx,
        { ...buildNativeLiveEncounterActionCommitInput(scope, plan), revisions },
        callbacks
      )
}
