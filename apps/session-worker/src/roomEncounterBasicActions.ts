import { persistEncounterBasicAction } from '@artificer-toolkit/encounter-persistence/basicActionPersistence'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { UseEncounterBasicActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { planNativeLiveBasicAction } from './nativeBasicAction.js'
import { assertRoomEncounterReadFence } from './roomEncounterTurns.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { readRoomSceneHeader, readRoomSceneEntities } from './roomSceneRead.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** Basic actions spend their allowance and retain effects and receipts in the same native commit. */
export async function executeRoomEncounterBasicAction(input: {
  ctx: EncounterCharacterWriteTransaction
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  observed: LiveSessionRulesRevisions
  command: UseEncounterBasicActionInputDto
}) {
  const { ctx, store, transaction, inputs, scope, observed } = input
  const plan = await planNativeLiveBasicAction(scope, input.command, {
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
  })
  if (plan.kind === 'REPLAY') return plan.result
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', scope.encounterId))
    .unique()
  if (!run) throw new Error('Room basic action Run is unavailable.')
  const actors = await readRunActors(ctx, readRunState(run))
  const ids = new Set(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const revisions = observed.filter(
    (revision) => revision.scope !== 'CHARACTER' || ids.has(revision.id)
  )
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
      }
    }
  )
}
