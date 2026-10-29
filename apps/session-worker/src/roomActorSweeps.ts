import { liveSessionWebSocketServerMessageDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { DurableCommandJournal } from './durableCommandJournal.js'
import { send } from './roomSocket.js'
import { endRoomBrokenRelationships, roomHasBrokenRelationships } from './roomRelationshipEnds.js'
import {
  readFrozenUnassignedCharacterIds,
  readRoomActorDepartures,
  reconcileRoomActorDepartures
} from './roomActorReconcile.js'
import { admitsRoomMember } from './roomAuthorization.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room steps that journal departures and broken relationships after a commit. */
export type RoomActorSweepHost = Pick<
  RoomCommandHost,
  | 'aggregateNeedsReload'
  | 'authorization'
  | 'bumpCacheGeneration'
  | 'challenge'
  | 'checkpointThrough'
  | 'flushOutbox'
  | 'inputs'
  | 'journal'
  | 'liveAdmission'
  | 'roomCampaignId'
  | 'store'
  | 'webSockets'
>

/**
 * One journaled transaction, only when an open Run names a departure or, on a Character notice, a
 * frozen actor's Character is gone (D200). Convex reads whether an unassigned Character still
 * exists only then; a deleted one's actor is removed, which Convex must ingest before the receipt,
 * so the room checkpoints first (D74).
 */
export async function reconcileActorDepartures(
  host: RoomActorSweepHost,
  current: NonNullable<ReturnType<DurableCommandJournal['readCurrent']>>,
  recheckFrozenCharacters = false
): Promise<void> {
  const authorization = host.authorization.current(current.authorityEpoch)
  if (!authorization) return
  if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
  const departures = await readRoomActorDepartures(host.store, host.inputs, authorization)
  const frozenCharacterIds = recheckFrozenCharacters
    ? await readFrozenUnassignedCharacterIds(host.store, authorization)
    : []
  if (!departures && !frozenCharacterIds.length) return
  const campaignId = host.roomCampaignId()
  if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
  const candidates = [...(departures?.unassignedCharacterIds ?? []), ...frozenCharacterIds]
  const deletedCharacterIds = candidates.length
    ? await host.inputs.deletedCharacterIds(candidates)
    : new Set<string>()
  // A frozen actor whose Character still exists stays frozen; nothing to journal.
  if (!departures && !deletedCharacterIds.size) return
  const commandId = crypto.randomUUID()
  const sequence = current.sequence + 1
  const receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
    type: 'COMMAND_COMMITTED',
    commandId,
    delta: null,
    sequence
  })
  host.store.assertAuthorityHead({
    epoch: current.authorityEpoch,
    sequence: current.sequence,
    checksum: current.stateChecksum
  })
  const checkpointBeforeAcknowledgement = deletedCharacterIds.size > 0
  await host.store.transact(
    (transaction) =>
      reconcileRoomActorDepartures({
        store: host.store,
        transaction,
        inputs: host.inputs,
        authorization,
        campaignId,
        epoch: current.authorityEpoch,
        deletedCharacterIds
      }),
    (entry) => {
      if (host.authorization.current(current.authorityEpoch) !== authorization)
        throw new Error('Room actor reconcile authorization changed before commit.')
      if (entry.sequence !== sequence)
        throw new Error('Room actor reconcile sequence does not match its authority.')
      const committed = host.journal.commitInTransaction({
        actorId: current.authorityEpoch,
        authorityEpoch: current.authorityEpoch,
        commandId,
        fingerprint: checksumCanonicalJson({
          type: 'RECONCILE_ACTOR_DEPARTURES',
          revisions: authorization.revisions,
          deletedCharacterIds: [...deletedCharacterIds].sort()
        }),
        expectedSequence: current.sequence,
        expectedStateChecksum: current.stateChecksum,
        nextStateChecksum: entry.chainChecksum,
        nextStateJson: current.stateJson,
        receiptJson: JSON.stringify(receipt),
        checkpointBeforeAcknowledgement
      })
      if (committed.kind !== 'COMMITTED')
        throw new Error('Room actor reconcile unexpectedly replayed inside its transaction.')
    }
  )
  if (checkpointBeforeAcknowledgement) {
    await host.checkpointThrough(current.authorityEpoch, sequence, 'ACKNOWLEDGEMENT')
    // A removed actor drops its token binding and controls, which a `delta: null` receipt does
    // not carry: cached play and Scene go, and members resume from the committed state.
    host.bumpCacheGeneration()
    for (const socket of host.webSockets()) host.challenge(socket)
    return
  }
  for (const recipient of host.webSockets()) {
    const member = host.liveAdmission(recipient)
    if (member && admitsRoomMember(authorization, member)) send(recipient, receipt)
  }
}

/**
 * One journaled transaction, only when an ACTIVE Run holds a relationship whose hold broke on its
 * own (D152): its source can't act, or a movement left the held creature beyond the sealed reach.
 */
export async function endBrokenRelationships(
  host: RoomActorSweepHost,
  current: NonNullable<ReturnType<DurableCommandJournal['readCurrent']>>
): Promise<void> {
  const authorization = host.authorization.current(current.authorityEpoch)
  if (!authorization) return
  if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
  const campaignId = host.roomCampaignId()
  if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
  const scope = {
    store: host.store,
    inputs: host.inputs,
    authorization,
    campaignId,
    epoch: current.authorityEpoch
  }
  if (!(await roomHasBrokenRelationships(scope))) return
  const commandId = crypto.randomUUID()
  const sequence = current.sequence + 1
  const receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
    type: 'COMMAND_COMMITTED',
    commandId,
    delta: null,
    sequence
  })
  host.store.assertAuthorityHead({
    epoch: current.authorityEpoch,
    sequence: current.sequence,
    checksum: current.stateChecksum
  })
  await host.store.transact(
    (transaction) =>
      endRoomBrokenRelationships({
        ...scope,
        transaction,
        commandId,
        occurredAt: new Date().toISOString()
      }),
    (entry) => {
      if (host.authorization.current(current.authorityEpoch) !== authorization)
        throw new Error('Room relationship end authorization changed before commit.')
      if (entry.sequence !== sequence)
        throw new Error('Room relationship end sequence does not match its authority.')
      const committed = host.journal.commitInTransaction({
        actorId: current.authorityEpoch,
        authorityEpoch: current.authorityEpoch,
        commandId,
        fingerprint: checksumCanonicalJson({ type: 'RELATIONSHIPS_ENDED', sequence }),
        expectedSequence: current.sequence,
        expectedStateChecksum: current.stateChecksum,
        nextStateChecksum: entry.chainChecksum,
        nextStateJson: current.stateJson,
        receiptJson: JSON.stringify(receipt),
        checkpointBeforeAcknowledgement: false
      })
      if (committed.kind !== 'COMMITTED')
        throw new Error('Room relationship end unexpectedly replayed inside its transaction.')
    }
  )
  for (const recipient of host.webSockets()) {
    const member = host.liveAdmission(recipient)
    if (member && admitsRoomMember(authorization, member)) send(recipient, receipt)
  }
}
