import { liveSessionWebSocketServerMessageDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionCheckpointJournalEntry } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { type SocketAttachment } from './roomSocket.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room steps that load the held aggregate from Convex. */
export type RoomAggregateLoadHost = Pick<
  RoomCommandHost,
  | 'aggregateNeedsReload'
  | 'authorization'
  | 'cache'
  | 'checkpointThrough'
  | 'flushOutbox'
  | 'inputs'
  | 'journal'
  | 'loadRoomAggregate'
  | 'refreshSceneCache'
  | 'setAggregateNeedsReload'
  | 'store'
>

/**
 * Flushes the outbox, then reloads the held aggregate and rebuilds the Scene cache from what
 * Convex now holds. A command whose stale path found `#aggregateNeedsReload` and an eager reload
 * share it.
 */
export async function reloadRoomAggregate(
  host: RoomAggregateLoadHost,
  value: SocketAttachment
): Promise<void> {
  await host.flushOutbox('RELOAD')
  await host.refreshSceneCache(value)
  await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
}

/** Transitional Convex-first commands reload only after their acknowledged product commit. */
export async function loadRoomAggregate(
  host: RoomAggregateLoadHost,
  sceneId: string | null
): Promise<void> {
  const current = host.journal.readCurrent()
  if (!current) throw new Error('Live Session authority changed.')
  if (host.store.corruption) throw host.store.corruption
  const sameHead =
    host.store.epoch === current.authorityEpoch &&
    host.store.sequence === current.sequence &&
    host.store.checksum === current.stateChecksum
  if (
    sameHead &&
    !host.aggregateNeedsReload() &&
    host.store.record('ROOM_INPUT', 'AUTHORITY') &&
    (sceneId === null || host.store.record('SCENE_CHECKPOINT_SOURCE', sceneId))
  )
    return
  if (current.sequence !== current.publishedSequence) {
    host.store.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    // Hydration reads Convex, so the room's unpublished commands are checkpointed first.
    await host.checkpointThrough(current.authorityEpoch, current.sequence, 'RELOAD')
    return host.loadRoomAggregate(sceneId)
  }
  const authorization =
    host.authorization.currentPlay(current.authorityEpoch) ??
    (await host.authorization.refresh(current.authorityEpoch))
  await host.inputs.hydrate({
    epoch: current.authorityEpoch,
    encounterId: authorization.play.encounter?.encounterId ?? null,
    sceneId,
    checkpoint: {
      epoch: current.authorityEpoch,
      sequence: current.publishedSequence,
      checksum: current.publishedChecksum
    }
  })
  host.setAggregateNeedsReload(false)
}

/**
 * A read that reloads stale Convex inputs writes the store outside any command. It is journaled
 * like a command with no receipt, so the store and journal heads stay equal and the room's
 * unpublished commands remain publishable. A store already behind a Convex-first command is left
 * for its next boundary reload.
 */
export function journalInputReload(
  host: RoomAggregateLoadHost,
  entry: LiveSessionCheckpointJournalEntry
): undefined {
  const current = host.journal.readCurrent()
  if (
    !current ||
    current.status !== 'ACTIVE' ||
    host.store.epoch !== current.authorityEpoch ||
    host.store.sequence !== current.sequence ||
    host.store.checksum !== current.stateChecksum
  )
    return undefined
  const commandId = crypto.randomUUID()
  const committed = host.journal.commitInTransaction({
    actorId: current.authorityEpoch,
    authorityEpoch: current.authorityEpoch,
    commandId,
    fingerprint: checksumCanonicalJson({
      type: 'RELOAD_ROOM_INPUTS',
      writeSetChecksum: entry.writeSetChecksum
    }),
    expectedSequence: current.sequence,
    expectedStateChecksum: current.stateChecksum,
    nextStateChecksum: entry.chainChecksum,
    nextStateJson: current.stateJson,
    receiptJson: JSON.stringify(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        type: 'COMMAND_COMMITTED',
        commandId,
        delta: null,
        sequence: entry.sequence
      })
    )
  })
  if (committed.kind !== 'COMMITTED')
    throw new Error('Room input reload unexpectedly replayed inside its transaction.')
  return undefined
}
