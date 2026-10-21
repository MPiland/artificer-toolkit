import { DurableCommandJournalError } from './durableCommandJournal.js'
import {
  createNativeLiveSessionState,
  hydrateNativeLiveSessionState
} from './nativeLiveSessionState.js'
import { callLiveSessionRoute } from './liveSessionRoutes.js'
import { type SocketAttachment } from './roomSocket.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room steps authority activation and storage recovery use. */
export type RoomStorageAuthorityHost = Pick<
  RoomCommandHost,
  | 'authorization'
  | 'loadRoomAggregate'
  | 'bumpCacheGeneration'
  | 'checkpoints'
  | 'afterCommands'
  | 'closeRoomSockets'
  | 'commandsSettled'
  | 'env'
  | 'flushOutbox'
  | 'journal'
  | 'outboxFlushing'
  | 'roomCampaignId'
  | 'setAggregateNeedsReload'
  | 'setCache'
  | 'storage'
  | 'store'
>

/**
 * Owns the room's authority lifecycle: the one activation that bootstraps its journal against
 * Convex, and the one storage recovery that moves a damaged room onto a replacement epoch.
 */
export class RoomStorageAuthority {
  #activation: Promise<void> | null = null
  #recovery: Promise<void> | null = null

  constructor(private readonly host: RoomStorageAuthorityHost) {}

  /** The activation in flight, if any. */
  activating(): Promise<void> | null {
    return this.#activation
  }

  /** The next admitted socket bootstraps a fresh epoch over a released journal. */
  reset(): void {
    this.#activation = null
  }

  async ensure(
    value: SocketAttachment,
    accessToken: string,
    role: 'OWNER' | 'PLAYER',
    userId: string,
    sceneId: string | null
  ): Promise<void> {
    if (!this.#activation) {
      const work = (async () => {
        const bootstrap = await callLiveSessionRoute(this.host.env, accessToken, 'bootstrap', {
          authorityEpoch: value.authorityEpoch,
          campaignId: value.campaignId,
          expectedRole: role,
          expectedUserId: userId
        })
        let current = this.host.journal.readCurrent()
        if (
          current &&
          current.authorityEpoch !== value.authorityEpoch &&
          bootstrap.persistedSequence === 0
        ) {
          // Convex verified the replacement epoch; a never-used or released journal can be rebuilt.
          this.host.journal.discardReplaceableAuthority(current.authorityEpoch)
          current = null
          this.host.setCache(null)
        }
        if (!current) {
          if (bootstrap.persistedSequence !== 0) {
            await this.#recover(value.authorityEpoch)
            throw new Error('Live Session storage was lost; reconnect to its replacement epoch.')
          }
          const initial = createNativeLiveSessionState()
          current = this.host.journal.activate({
            authorityEpoch: value.authorityEpoch,
            snapshotChecksum: initial.stateChecksum,
            stateJson: initial.stateJson
          })
        }
        if (current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
          throw new Error('Live Session authority changed.')
        if (
          bootstrap.persistedSequence < current.publishedSequence ||
          bootstrap.persistedSequence > current.sequence
        )
          throw new Error('Live Session publication state is inconsistent.')
        if (current.publishedSequence < bootstrap.persistedSequence) {
          await this.host.flushOutbox('ACTIVATION')
          current = this.host.journal.readCurrent()
          if (!current || current.publishedSequence !== bootstrap.persistedSequence)
            throw new Error('Live Session checkpoint recovery is incomplete.')
        }
        if (current.sequence === 0) {
          const activated = await callLiveSessionRoute(this.host.env, null, 'activate', {
            activationFingerprint: bootstrap.activationFingerprint,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            stateChecksum: current.stateChecksum
          })
          if (
            activated.phase !== 'DO_ACTIVE' ||
            activated.persistedSequence !== 0 ||
            activated.persistedStateChecksum !== current.stateChecksum
          )
            throw new Error('Live Session activation did not commit.')
        } else if (
          current.publishedSequence !== bootstrap.persistedSequence ||
          current.publishedChecksum !== bootstrap.persistedStateChecksum
        )
          throw new Error('Live Session publication checksum is inconsistent.')
        await this.host.flushOutbox('ACTIVATION')
      })()
      this.#activation = work
      void work.catch(() => {
        if (this.#activation === work) this.#activation = null
      })
    }
    await this.#activation
    const current = this.host.journal.readCurrent()
    if (!current || current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
      throw new Error('Live Session authority changed.')
    // The room store runs one operation at a time: a hydrate racing a command would rewind the store
    // behind the journal, so admissions load behind the running commands.
    await this.host.afterCommands(() => this.host.loadRoomAggregate(sceneId))
  }

  /** Corrupt SQLite or a missing unpublished prefix can only resume under a new Convex fence. */
  async recoverIfNeeded(fallbackEpoch?: string): Promise<boolean> {
    await this.host.commandsSettled()
    if (this.#recovery) {
      await this.#recovery
      return true
    }
    let damaged = this.host.store.corruption !== null
    try {
      const current = this.host.journal.readCurrent()
      if (current) {
        try {
          hydrateNativeLiveSessionState(current.stateJson)
        } catch {
          damaged = true
        }
      }
      if (current && current.sequence > 0 && this.host.store.epoch === null) damaged = true
      if (current && current.sequence !== current.publishedSequence) {
        try {
          this.host.store.assertAuthorityHead({
            epoch: current.authorityEpoch,
            sequence: current.sequence,
            checksum: current.stateChecksum
          })
        } catch {
          damaged = true
        }
      }
    } catch (error) {
      if (!(error instanceof DurableCommandJournalError) || error.code !== 'CORRUPT_JOURNAL')
        throw error
      damaged = true
    }
    if (!damaged) return false
    const epoch = this.host.journal.authorityEpoch ?? fallbackEpoch
    if (!epoch) throw new Error('Corrupt room storage has no authority fence.')
    await this.#recover(epoch)
    return true
  }

  /** No abandoned suffix is published; the replacement first hydrates the acknowledged product state. */
  #recover(epoch: string): Promise<void> {
    if (this.#recovery) return this.#recovery
    this.host.closeRoomSockets('Live Session storage recovered; reconnect to resynchronize.')
    const work = (async () => {
      await this.host.commandsSettled()
      await this.host.outboxFlushing()?.catch(() => undefined)
      const campaignId = this.host.roomCampaignId()
      if (!campaignId) throw new Error('Live Session room identity is missing.')
      const replacement = await callLiveSessionRoute(this.host.env, null, 'recoverStorage', {
        campaignId,
        epoch
      })
      if (
        replacement.epoch === epoch ||
        replacement.phase !== 'ACTIVATING' ||
        replacement.persistedSequence !== 0
      )
        throw new Error('Live Session storage recovery did not reserve a replacement epoch.')
      const initial = createNativeLiveSessionState()
      this.host.store.hydrate({
        epoch: replacement.epoch,
        documents: [],
        records: [],
        checkpoint: {
          epoch: replacement.epoch,
          sequence: 0,
          checksum: initial.stateChecksum
        },
        commitDurable: () => {
          this.host.journal.discardFencedAuthorityInTransaction(epoch)
          this.host.checkpoints.discardFencedCheckpointInTransaction()
          this.host.storage.sql.exec('DELETE FROM room_idle_release')
          return undefined
        }
      })
      this.#activation = null
      this.host.setAggregateNeedsReload(true)
      this.host.authorization.invalidate()
      this.host.bumpCacheGeneration()
    })()
    this.#recovery = work
    void work.then(
      () => {
        if (this.#recovery === work) this.#recovery = null
      },
      () => {
        if (this.#recovery === work) this.#recovery = null
      }
    )
    return work
  }
}
