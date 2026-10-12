import {
  persistEncounterBasicActionResponse,
  persistEncounterEscapeResponse
} from '@artificer-toolkit/encounter-persistence/basicActionCheckResponsePersistence'
import { persistEncounterBasicAction } from '@artificer-toolkit/encounter-persistence/basicActionPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { persistEncounterEscape } from '@artificer-toolkit/encounter-persistence/escapePersistence'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type {
  EscapeRelationshipInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterBasicActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { planNativeLiveBasicActionResponse } from './nativeBasicActionResponse.js'
import { planNativeLiveEscape } from './nativeEscapeAction.js'
import { planNativeLiveEscapeResponse } from './nativeEscapeActionResponse.js'
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

export type RoomBasicActionInput = {
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

/** A planned CHECK action spends its allowance and pends or settles its check in one native commit. */
export async function persistRoomEncounterCheckAction(
  input: RoomBasicActionInput & { planned: LiveSessionEncounterBasicActionCommitInput }
) {
  const { ctx, store, transaction, inputs, scope, observed, planned } = input
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

/** An Escape spends its activation and pends or settles the holder's check in one native commit. */
export async function executeRoomEncounterEscape(
  input: RoomBasicActionInput & { command: EscapeRelationshipInputDto }
) {
  const { ctx, transaction, scope, observed } = input
  const plan = await planNativeLiveEscape(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
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

/** The holder's d20 settles a pending Escape check and frees them in one native commit. */
export async function executeRoomEncounterEscapeResponse(
  input: RoomBasicActionInput & { command: ResolveRuleOccurrenceInputDto }
) {
  const { ctx, scope, observed } = input
  const plan = await planNativeLiveEscapeResponse(scope, input.command, basicActionExecution(input))
  if (plan.kind === 'REPLAY') return plan.result
  const revisions = await readBasicActionRevisions(input)
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  return persistEncounterEscapeResponse(
    ctx,
    { ...plan.input, revisions },
    {
      validateReadFence: async (state, characterIds, fence) =>
        assertRoomEncounterRulesRevisions(observed, state, characterIds, fence)
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
