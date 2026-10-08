import { persistEncounterBasicActionResponse } from '@artificer-toolkit/encounter-persistence/basicActionCheckResponsePersistence'
import { persistEncounterBasicAction } from '@artificer-toolkit/encounter-persistence/basicActionPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  ResolveRuleOccurrenceInputDto,
  UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { planNativeLiveBasicAction } from './nativeBasicAction.js'
import { planNativeLiveBasicActionResponse } from './nativeBasicActionResponse.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import {
  assertRoomEncounterReadFence,
  assertRoomEncounterRulesRevisions
} from './roomEncounterTurns.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { readRoomSceneHeader, readRoomSceneEntities } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

type RoomBasicActionInput = {
  ctx: EncounterWriteTransaction
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
    captures: {
      encounterRules: (request: Parameters<typeof readRoomEncounterTurnCapture>[3]) =>
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
      prepareCharacter: (characterScope: Parameters<typeof prepareRoomLiveCharacterSheet>[2]) =>
        prepareRoomLiveCharacterSheet(store, inputs, characterScope, observed, transaction)
    }
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

/** Basic actions spend their allowance and retain effects and receipts in the same native commit. */
export async function executeRoomEncounterBasicAction(
  input: RoomBasicActionInput & { command: UseEncounterBasicActionInputDto }
) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const plan = await planNativeLiveBasicAction(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterBasicAction(
    ctx,
    { ...plan.input, revisions },
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
        })
    }
  )
}

/** The helper's d20 settles a pending basic action check and its stabilize in one native commit. */
export async function executeRoomEncounterBasicActionResponse(
  input: RoomBasicActionInput & { command: ResolveRuleOccurrenceInputDto }
) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const plan = await planNativeLiveBasicActionResponse(
    scope,
    input.command,
    basicActionExecution(input)
  )
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterBasicActionResponse(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: async (state, characterIds, fence) =>
        assertRoomEncounterRulesRevisions(observed, state, characterIds, fence),
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
        })
    }
  )
}
