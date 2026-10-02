import { persistEncounterCleavingResponse } from '@artificer-toolkit/encounter-persistence/cleavingResponsePersistence'
import { bindEncounterConcentrationApplications } from '@artificer-toolkit/encounter-persistence/concentrationChildrenPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { planNativeLiveCleavingResponse } from './nativeCleavingResponse.js'
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

/** Damage, concentration checks, the next choice and receipts settle in one native write set. */
export async function executeRoomEncounterCleavingResponse(input: {
  ctx: Parameters<typeof persistRoomConcentrationChildren>[0]
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  command: ResolveRuleOccurrenceInputDto
  runtime: RulesRuntimeService
  random(maximum: number): number
}) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const plan = await planNativeLiveCleavingResponse(scope, input.command, {
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
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', scope.encounterId))
    .unique()
  if (!run) throw new Error('Room Cleaving Run is unavailable.')
  const ids = new Set(
    (await readRunActors(ctx, readRunState(run))).flatMap((actor) =>
      actor.kind === 'CHARACTER' ? [actor.sourceId] : []
    )
  )
  for (const request of plan.input.maintenanceOwners)
    if (request.owner.kind === 'CHARACTER') ids.add(request.owner.characterId)
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterCleavingResponse(
    ctx,
    { ...plan.input, revisions },
    {
      readMaintenanceCapture: (state, request) => readRoomMaintenanceCapture(ctx, state, request),
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
      bindConcentrationApplications: (state, applications) =>
        bindEncounterConcentrationApplications(ctx, state, applications),
      persistConcentrationChildren: (children) => persistRoomConcentrationChildren(ctx, children)
    }
  )
}
