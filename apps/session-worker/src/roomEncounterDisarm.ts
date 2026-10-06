import {
  persistEncounterDisarmPending,
  persistEncounterDisarmCommit
} from '@artificer-toolkit/encounter-persistence/disarmPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { planNativeLiveDisarm } from './nativeDisarm.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { assertRoomEncounterRulesRevisions } from './roomEncounterTurns.js'
import { readRoomActionSceneInputs } from './roomActionSceneInputs.js'
import { readRoomSceneHeader, readRoomSceneEntities } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** The sealed contest, item transition, action economy and receipts use the same native commit. */
export async function executeRoomEncounterDisarm(input: {
  ctx: Parameters<typeof persistEncounterDisarmCommit>[0]
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
  const plan = await planNativeLiveDisarm(scope, input.command, {
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
  if (!run) throw new Error('Room Disarm Run is unavailable.')
  const ids = new Set(
    (await readRunActors(ctx, readRunState(run))).flatMap((actor) =>
      actor.kind === 'CHARACTER' ? [actor.sourceId] : []
    )
  )
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  const callbacks: Parameters<typeof persistEncounterDisarmCommit>[2] = {
    readActionSceneInputs: (state, command) =>
      readRoomActionSceneInputs(ctx, transaction, state, command),
    validateReadFence: async (state, characterIds, revisions) =>
      assertRoomEncounterRulesRevisions(observed, state, characterIds, revisions)
  }
  return plan.kind === 'PENDING'
    ? persistEncounterDisarmPending(ctx, { ...plan.input, revisions }, callbacks)
    : persistEncounterDisarmCommit(ctx, { ...plan.input, revisions }, callbacks)
}
