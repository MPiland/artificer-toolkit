import {
  replaceRunCharacterActor,
  selectRunCharacterSwaps,
  type RunCharacterSwap
} from '@artificer-toolkit/encounter-persistence/actorCharacterReplacement'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { classifyRuleOccurrenceVoid } from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import {
  pendingDecisionActorIds,
  readPendingRunDecision
} from '@artificer-toolkit/encounter-persistence/pendingReads'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import type { EncounterDocument } from '@artificer-toolkit/encounter-persistence/store'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { liveSessionWebSocketServerMessageDtoSchema } from '@artificer-toolkit/schema/api/liveSessions'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { v5 as uuidV5 } from 'uuid'
import type { DurableCommandJournal } from './durableCommandJournal.js'
import { createNativeLiveSessionState } from './nativeLiveSessionState.js'
import type { RoomActorSweepHost } from './roomActorSweeps.js'
import { roomEncounterCommandFingerprint } from './roomEncounterCommands.js'
import {
  commitRoomEncounterCommand,
  type RoomEncounterExecutionHost
} from './roomEncounterExecution.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import {
  readRoomEncounterResponseRoute,
  roomOwnsEncounterVoid
} from './roomEncounterResponseRouting.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { persistRoomSceneTokenCharacter } from './roomSceneCommandPersistence.js'
import { commitMovementDecision } from './roomSceneCommit.js'
import { readRoomScene, readRoomSceneState } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'

const swapNamespace = '0f3c9a51-2b7e-4d86-a1c4-6e9d2f7b8a03'

/** The room steps an Active Character swap reads and commits with. */
export type RoomActiveCharacterSwapHost = RoomEncounterExecutionHost & RoomActorSweepHost

type Current = NonNullable<ReturnType<DurableCommandJournal['readCurrent']>>

/** A benched Character's actor an open Run the room holds, and the owner's Active Character it becomes. */
export type ActiveCharacterSwap = RunCharacterSwap & { run: EncounterDocument<'encounterRuns'> }

/** D236: the swaps every open Run the room holds owes its players (`selectRunCharacterSwaps`). */
export async function readRoomActiveCharacterSwaps(
  store: RoomEncounterStore,
  authorization: LiveSessionRoomAuthorization
): Promise<ActiveCharacterSwap[]> {
  const { members, assignments } = authorization.campaign
  if (!members.length) return []
  const swaps: ActiveCharacterSwap[] = []
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status === 'COMPLETED') continue
    const actors = await readRunActors({ db: store.store }, state)
    for (const swap of selectRunCharacterSwaps(actors, assignments)) swaps.push({ ...swap, run })
  }
  return swaps
}

/** A bound token, the Character its actor now plays, and the room replacement that caused it. */
export type TokenRepoint = {
  sceneId: string
  tokenId: string
  characterId: string
  actionOrigin?: { encounterId: string; commandId: string }
}

/**
 * Bound tokens on the presented Scene that still name another Character than their actor plays: the
 * actor of a Run Convex swapped while no room held it (D236). A token naming no Character stays.
 */
export async function readRoomStaleTokens(
  store: RoomEncounterStore,
  scene: Pick<CampaignSceneStateDto, 'id' | 'tokens'> | null
): Promise<TokenRepoint[]> {
  if (!scene) return []
  const repoints: TokenRepoint[] = []
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status === 'COMPLETED') continue
    for (const actor of await readRunActors({ db: store.store }, state)) {
      if (actor.kind !== 'CHARACTER' || actor.frozenState) continue
      const binding = await store.store
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) =>
          q.eq('encounterId', run.id).eq('actorId', actor.id)
        )
        .unique()
      if (binding?.sceneId !== scene.id) continue
      const token = scene.tokens.find(({ id }) => id.toLowerCase() === binding.tokenId)
      if (token?.characterId && token.characterId !== actor.sourceId)
        repoints.push({
          sceneId: binding.sceneId,
          tokenId: binding.tokenId,
          characterId: actor.sourceId
        })
    }
  }
  return repoints
}

/**
 * Puts each player's new Active Character into the open Runs that hold their benched one (D236).
 * The actor first stops what it was doing, as the GM: a decision it owes that a void can settle is
 * voided as its own room command, whose post-commit step calls this again; a decision a void
 * refuses waits for its answer. Every clear swap then commits in one journaled transaction that
 * keeps the actor and rewrites who it is, and repoints its bound token on a Scene the room holds,
 * with any stale token of the presented Scene. Convex ingests it before the receipt, and members
 * resume from the committed state. A swap on the actor's turn then ends that turn.
 */
export async function settleRoomActiveCharacterSwaps(
  host: RoomActiveCharacterSwapHost,
  current: Current
): Promise<void> {
  const epoch = current.authorityEpoch
  const authorization = host.authorization.current(epoch)
  if (!authorization) return
  if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
  const swaps = await readRoomActiveCharacterSwaps(host.store, authorization)
  const stale = await readRoomStaleTokens(host.store, host.cache()?.uncomposedScene ?? null)
  if (!swaps.length && !stale.length) return
  const campaignId = host.roomCampaignId()
  if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
  const { ownerUserId } = authorization.campaign
  const issuer = {
    socket: null,
    admission: { role: 'OWNER', userId: ownerUserId },
    value: { authorityEpoch: epoch, campaignId }
  } as const
  const ctx = await roomEncounterReadTransaction({
    store: host.store,
    inputs: host.inputs,
    authorization,
    campaignId,
    epoch,
    userId: ownerUserId,
    observed: host.inputs.revisions(campaignId, authorization.revisions)
  })
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(campaignId, ownerUserId)
  const clear: ActiveCharacterSwap[] = []
  for (const swap of swaps) {
    const { run, actorId, characterId } = swap
    const key = `${run.id}:${actorId}:${characterId}`
    const pending = await readPendingRunDecision(ctx, run, campaign, membership)
    if (pending) {
      if (!pendingDecisionActorIds(pending).includes(actorId)) continue
      const occurrence = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', pending.occurrenceId))
        .unique()
      const snapshot = occurrence && (await readPendingSnapshot(ctx, occurrence))
      if (!snapshot || classifyRuleOccurrenceVoid(snapshot.applicationContext).kind === 'REFUSE')
        continue
      const command = {
        type: 'VOID_RULE_OCCURRENCE' as const,
        encounterId: run.id,
        commandId: uuidV5(
          `${key}:${pending.occurrenceId}:${pending.occurrenceVersion}:void`,
          swapNamespace
        ),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion
      }
      const fingerprint = roomEncounterCommandFingerprint(command)
      if (
        (await readRoomEncounterResponseRoute(host.store, command)) === 'MOVEMENT' &&
        !(await roomOwnsEncounterVoid(host.store, command))
      )
        await commitMovementDecision(host, issuer, command, fingerprint)
      else await commitRoomEncounterCommand(host, issuer, command, fingerprint)
      return
    }
    clear.push(swap)
  }
  if (clear.length || stale.length)
    await commitActiveCharacterSwaps(host, current, authorization, campaignId, clear, stale)
  // The replacement keeps the turn pointer, so a swap on the actor's turn ends that turn once, here,
  // even when the actor is the only one left to take a turn.
  for (const { run, actorId, characterId } of clear) {
    const swapped = host.store.documents('encounterRuns').find(({ id }) => id === run.id)
    if (swapped?.status !== 'ACTIVE' || readRunState(swapped).currentActorId !== actorId) continue
    const command = {
      type: 'ADVANCE_TURN' as const,
      encounterId: run.id,
      commandId: uuidV5(
        `${run.id}:${actorId}:${characterId}:${swapped.version}:advance`,
        swapNamespace
      ),
      expectedVersion: swapped.version
    }
    await commitRoomEncounterCommand(
      host,
      issuer,
      command,
      roomEncounterCommandFingerprint(command)
    )
  }
}

async function commitActiveCharacterSwaps(
  host: RoomActiveCharacterSwapHost,
  current: Current,
  authorization: LiveSessionRoomAuthorization,
  campaignId: string,
  swaps: readonly ActiveCharacterSwap[],
  stale: readonly TokenRepoint[]
): Promise<void> {
  const epoch = current.authorityEpoch
  const { ownerUserId } = authorization.campaign
  const commandId = crypto.randomUUID()
  const sequence = current.sequence + 1
  const receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
    type: 'COMMAND_COMMITTED',
    commandId,
    delta: null,
    sequence
  })
  const presentedSceneId = host.cache()?.scene?.id ?? null
  let nextStateJson = current.stateJson
  host.store.assertAuthorityHead({
    epoch,
    sequence: current.sequence,
    checksum: current.stateChecksum
  })
  await host.store.transact(
    async (transaction) => {
      const ctx = await roomEncounterWriteTransaction({
        store: host.store,
        transaction,
        inputs: host.inputs,
        authorization,
        campaignId,
        epoch,
        userId: ownerUserId,
        observed: host.inputs.revisions(campaignId, authorization.revisions)
      })
      const occurredAt = new Date().toISOString()
      const repoints = [...stale]
      for (const { run, actorId, characterId, userId } of swaps) {
        const replacementId = uuidV5(
          `${run.id}:${actorId}:${characterId}:${run.version}:replace`,
          swapNamespace
        )
        await replaceRunCharacterActor(ctx, {
          state: readRunState(run),
          actorId,
          characterId,
          userId: ownerUserId,
          commandId: replacementId,
          occurredAt
        })
        const character = await ctx.ports.readCharacterRow(characterId)
        if (!character || character.userId !== userId)
          throw new Error('Replacement Character is unavailable.')
        const binding = await ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) =>
            q.eq('encounterId', run.id).eq('actorId', actorId)
          )
          .unique()
        if (binding)
          repoints.push({
            sceneId: binding.sceneId,
            tokenId: binding.tokenId,
            characterId,
            actionOrigin: { encounterId: run.id, commandId: replacementId }
          })
      }
      for (const repoint of repoints) {
        const character = await ctx.ports.readCharacterRow(repoint.characterId)
        if (!character) throw new Error('Bound token Character is unavailable.')
        const repointed = await repointBoundToken(transaction, repoint, character, ownerUserId)
        if (repointed && repoint.sceneId === presentedSceneId)
          nextStateJson = createNativeLiveSessionState(
            (
              await composeRoomSceneVision({
                store: host.store,
                transaction,
                inputs: host.inputs,
                authorization,
                campaignId,
                epoch,
                scene: (await readRoomSceneState(transaction, repoint.sceneId)).scene
              })
            ).scene
          ).stateJson
      }
    },
    (entry) => {
      if (host.authorization.current(epoch) !== authorization)
        throw new Error('Room Active Character swap authorization changed before commit.')
      if (entry.sequence !== sequence)
        throw new Error('Room Active Character swap sequence does not match its authority.')
      const committed = host.journal.commitInTransaction({
        actorId: epoch,
        authorityEpoch: epoch,
        commandId,
        fingerprint: checksumCanonicalJson({
          type: 'ACTIVE_CHARACTER_SWAP',
          revisions: authorization.revisions,
          swaps: swaps.map(({ run, actorId, characterId }) => [
            run.id,
            run.version,
            actorId,
            characterId
          ]),
          stale
        }),
        expectedSequence: current.sequence,
        expectedStateChecksum: current.stateChecksum,
        nextStateChecksum: entry.chainChecksum,
        nextStateJson,
        receiptJson: JSON.stringify(receipt),
        checkpointBeforeAcknowledgement: true
      })
      if (committed.kind !== 'COMMITTED')
        throw new Error('Room Active Character swap unexpectedly replayed inside its transaction.')
    }
  )
  await host.checkpointThrough(epoch, sequence, 'ACKNOWLEDGEMENT')
  // The actor's identity, resources and token changed, which a `delta: null` receipt does not carry:
  // cached play and Scene go, and members resume from the committed state.
  host.bumpCacheGeneration()
  for (const socket of host.webSockets()) host.challenge(socket)
}

/** Repoints a bound token on a Scene the room holds; returns false when the room holds none. */
async function repointBoundToken(
  transaction: RoomTransaction,
  repoint: TokenRepoint,
  character: { id: string; label: string },
  actorUserId: string
): Promise<boolean> {
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', repoint.sceneId)
  if (!sourceRecord) return false
  const { presentationVersion } = liveSessionCheckpointSceneSourceSchema.parse(
    JSON.parse(sourceRecord.json)
  )
  const { scene, baseOrdinals } = await readRoomSceneState(transaction, repoint.sceneId)
  persistRoomSceneTokenCharacter({
    transaction,
    header: readRoomScene(transaction, repoint.sceneId).header,
    scene,
    baseOrdinals,
    tokenId: repoint.tokenId,
    character,
    commandId: crypto.randomUUID(),
    actorUserId,
    presentationVersion,
    saveId: crypto.randomUUID(),
    now: Date.now(),
    actionOrigin: repoint.actionOrigin
  })
  return true
}
