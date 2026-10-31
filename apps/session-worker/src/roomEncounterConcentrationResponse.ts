import {
  persistEncounterConcentrationResponse,
  persistEncounterConcentrationWindowOpen
} from '@artificer-toolkit/encounter-persistence/concentrationResponsePersistence'
import { applyLiveConcentrationCleanup } from '@artificer-toolkit/encounter-persistence/concentrationCleanupPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { planNativeLiveConcentrationResponse } from './nativeConcentrationResponse.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { assertRoomEncounterRulesRevisions } from './roomEncounterTurns.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { readRoomActionSceneInputs } from './roomActionSceneInputs.js'
import { readRoomSceneHeader, readRoomSceneEntities } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { persistRoomConcentrationChildren } from './roomConcentrationPersistence.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** Resumes an admitted concentration child, including its successor and cleanup, before ack. */
export async function executeRoomEncounterConcentrationResponse(input: {
  ctx: Parameters<typeof persistEncounterConcentrationResponse>[0]
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
  const plan = await planNativeLiveConcentrationResponse(scope, input.command, {
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
  if (!run) throw new Error('Room concentration Run is unavailable.')
  const ids = new Set(
    (await readRunActors(ctx, readRunState(run))).flatMap((actor) =>
      actor.kind === 'CHARACTER' ? [actor.sourceId] : []
    )
  )
  if (plan.kind === 'PLANNED')
    for (const request of plan.input.maintenanceOwners)
      if (request.owner.kind === 'CHARACTER') ids.add(request.owner.characterId)
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
  mergeNativeRulesRevisions(revisions, plan.input.revisions)
  const validateReadFence = async (
    state: Parameters<typeof assertRoomEncounterRulesRevisions>[1],
    characterIds: readonly string[],
    fenced: LiveSessionRulesRevisions
  ) => assertRoomEncounterRulesRevisions(observed, state, characterIds, fenced)
  // The roll opened a d20 window: the occurrence pends on it and nothing else commits.
  if (plan.kind === 'D20_WINDOW_PAUSE')
    return persistEncounterConcentrationWindowOpen(
      ctx,
      { ...plan.input, revisions },
      { validateReadFence }
    )
  return persistEncounterConcentrationResponse(
    ctx,
    { ...plan.input, revisions },
    {
      currentCharacterStreamVersion: async (state, id) => {
        const character = await ctx.ports.readCharacterRow(id)
        if (
          !character ||
          character.status !== 'ACTIVE' ||
          character.systemId !== state.gameSystemId
        )
          throw new Error('Room concentration Character changed.')
        return character.play.streamVersion
      },
      readMaintenanceCapture: (state, request) => readRoomMaintenanceCapture(ctx, state, request),
      readActionSceneInputs: (state, command) =>
        readRoomActionSceneInputs(ctx, transaction, state, command),
      validateReadFence,
      applyCleanup: (cleanup) => applyLiveConcentrationCleanup(ctx, cleanup),
      persistConcentrationChildren: (children) => persistRoomConcentrationChildren(ctx, children)
    }
  )
}
