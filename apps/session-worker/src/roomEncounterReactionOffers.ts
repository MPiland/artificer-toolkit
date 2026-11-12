import type { EncounterPersistenceTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { persistReactionOfferAnswer } from '@artificer-toolkit/encounter-persistence/reactionOfferAnswer'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { systemTriggerReactionCommand } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import type { RoomRecordReader } from './roomEncounterStore.js'
import { readRoomScene } from './roomSceneRead.js'

/**
 * Settles a reaction offer's answer (D219) and, for a chosen option, runs the reaction as the
 * reactor's own action against the attacker in the same room command. The command is one
 * transaction, so a reaction that is refused takes the answer back with it and the offer stays
 * open; one that pauses on evidence of its own commits later from that evidence's answer. A stored
 * answer replays without running the reaction again.
 */
export async function executeRoomReactionOfferAnswer<ActionResult>(input: {
  ctx: EncounterPersistenceTransaction
  transaction: RoomRecordReader
  command: ResolveRuleOccurrenceInputDto
  executeAction(command: ResolveEncounterActionInputDto): Promise<ActionResult>
}): Promise<EncounterCommandResultDto | ActionResult> {
  const { ctx, command } = input
  const encounterId = command.encounterId.toLowerCase()
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (query) => query.eq('id', command.occurrenceId.toLowerCase()))
    .unique()
  const context =
    occurrence?.state === 'PENDING'
      ? (await readPendingSnapshot(ctx, occurrence))?.applicationContext
      : null
  const answered = await persistReactionOfferAnswer(ctx, {
    response: command,
    occurredAt: new Date().toISOString()
  })
  // No pending offer means the stored answer replayed.
  if (context?.kind !== 'ENCOUNTER_REACTION_OFFER' || command.resolution.kind !== 'OPTION')
    return answered
  const { optionId } = command.resolution
  const actionId = context.options.find((option) => option.optionId === optionId)?.actionId
  if (actionId === undefined) throw new Error('Reaction offer option is unavailable.')
  // The answer's receipt admits this one command, on the Run version the answer produced.
  return input.executeAction(
    systemTriggerReactionCommand({
      encounterId,
      expectedVersion: command.expectedVersion + 1,
      parentCommandId: context.parentCommandId,
      holderActorId: context.reactorActorId,
      actionId,
      targetActorId: context.attackerActorId,
      sceneContext: await readOfferSceneContext(input, encounterId, context)
    })
  )
}

/** An offer is raised only on a Scene, so the reaction is judged where both tokens stand now. */
async function readOfferSceneContext(
  input: { ctx: EncounterPersistenceTransaction; transaction: RoomRecordReader },
  encounterId: string,
  offer: { reactorActorId: string; attackerActorId: string }
): Promise<NonNullable<ResolveEncounterActionInputDto['sceneContext']>> {
  const [source, target] = await Promise.all(
    [offer.reactorActorId, offer.attackerActorId].map((actorId) =>
      input.ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (query) =>
          query.eq('encounterId', encounterId).eq('actorId', actorId)
        )
        .unique()
    )
  )
  if (!source || !target || source.sceneId !== target.sceneId)
    throw new Error('The reactor and its attacker are no longer on one Scene.')
  return {
    sceneId: source.sceneId,
    expectedSceneVersion: readRoomScene(input.transaction, source.sceneId).header.version,
    sourceTokenId: source.tokenId,
    targetTokenId: target.tokenId
  }
}
