import type { LiveSessionCheckpointReason } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT } from '@artificer-toolkit/schema/api/liveSessionCommands'
import { ROOM_LIMITS } from './roomLimits.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room steps the outbox uses. */
export type RoomOutboxPort = Pick<
  RoomCommandHost,
  | 'authorization'
  | 'checkpoints'
  | 'journal'
  | 'roomCampaignId'
  | 'scheduleAlarm'
  | 'store'
  | 'waitUntil'
>

/**
 * The room's publication of committed commands to Convex: one flush runs at a time, a checkpoint
 * fence waits for it, and a full chat backlog saves in the background.
 */
export class RoomOutbox {
  #flushing: Promise<void> | null = null
  /** A failed backlog save is not retried before this time. */
  #backlogRetryAt = 0

  constructor(private readonly port: RoomOutboxPort) {}

  /** The flush in flight, if any. */
  flushing(): Promise<void> | null {
    return this.#flushing
  }

  /** Admissions and drains retry a retained checkpoint; commands save at save points and at the backlog bound. */
  publishInBackground(): void {
    this.port.waitUntil(this.flush('ADMISSION').catch(() => undefined))
  }

  /** `reason` is the trigger a checkpoint this flush sends is attributed to; see `RoomMeter`. */
  flush(reason: LiveSessionCheckpointReason): Promise<void> {
    if (this.#flushing) return this.#flushing
    const work = this.#publish(reason)
    this.#flushing = work
    void work.then(
      () => {
        if (this.#flushing === work) this.#flushing = null
      },
      () => {
        if (this.#flushing === work) this.#flushing = null
      }
    )
    return work
  }

  /** An older in-flight prefix cannot satisfy a later lifecycle command's acknowledgement fence. */
  async checkpointThrough(
    epoch: string,
    sequence: number,
    reason: LiveSessionCheckpointReason
  ): Promise<void> {
    if (this.#flushing) await this.#flushing
    let previous = -1
    for (;;) {
      const head = this.port.journal.readCurrent()
      if (!head || head.authorityEpoch !== epoch)
        throw new Error('Live Session authority changed during its checkpoint.')
      if (head.publishedSequence >= sequence) return
      if (head.publishedSequence === previous)
        throw new Error('The lifecycle checkpoint made no progress.')
      previous = head.publishedSequence
      await this.flush(reason)
    }
  }

  /** Publishes every committed command and returns the sequence Convex now holds, or null with no live head. */
  async publishThroughHead(): Promise<number | null> {
    const head = this.port.journal.readCurrent()
    if (!head || head.status === 'RELEASED') return null
    await this.checkpointThrough(head.authorityEpoch, head.sequence, 'BARRIER')
    return head.sequence
  }

  async #publish(reason: LiveSessionCheckpointReason): Promise<void> {
    // Backlog and admission flushes run beside the command chain, so the head is read between commands.
    const scope = await this.port.store.whenClosed(() => {
      const current = this.port.journal.readCurrent()
      const campaignId = this.port.roomCampaignId()
      if (!current || !campaignId || current.status === 'RELEASED') return null
      if (this.port.store.epoch !== current.authorityEpoch) {
        if (current.sequence !== current.publishedSequence)
          throw new Error('The pending checkpoint has no matching room aggregate.')
        return null
      }
      if (
        current.sequence === current.publishedSequence &&
        (this.port.store.sequence !== current.sequence ||
          this.port.store.checksum !== current.stateChecksum)
      )
        return null // An acknowledged Convex-first command reloads its aggregate at the next boundary.
      this.port.store.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      return { current, campaignId }
    })
    if (!scope) return
    const { current, campaignId } = scope
    const sent = this.port.authorization.current(current.authorityEpoch)?.revisions ?? null
    const response = await this.port.checkpoints.flush(
      { campaignId, epoch: current.authorityEpoch, knownAuthorization: sent },
      reason
    )
    if (response) {
      const head = this.port.journal.readCurrent()
      if (head && head.sequence === head.publishedSequence)
        this.port.authorization.acknowledgePlay(current.authorityEpoch)
    }
    await this.port.scheduleAlarm()
  }

  /**
   * The only save that is not a lifecycle moment (ADR 0035 Amendment 25): when the unsaved log holds
   * a chat push window of new chat entries and roll cards, the room saves in the background, so
   * Convex chat paging never has a gap. The journal's size is not a trigger: a checkpoint pages
   * itself, so one save stays one page however large the backlog. It runs after the commit, so it
   * never delays an acknowledgement. A flush already running carries the log, and a failed one waits
   * `alarmRetryMs` because the bound stays crossed.
   */
  saveBacklogIfFull(): void {
    if (this.port.store.unsavedChatEntries < LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT) return
    if (this.#flushing || Date.now() < this.#backlogRetryAt) return
    this.port.waitUntil(
      this.flush('BACKLOG').catch((error) => {
        this.#backlogRetryAt = Date.now() + ROOM_LIMITS.alarmRetryMs
        console.error('Live Session backlog save failed.', error)
      })
    )
  }
}
