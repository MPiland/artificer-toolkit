import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import {
  LIVE_SESSION_CHECKPOINT_BARRIER_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_METER_PATH,
  type EncounterSessionFrameDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { convexEnvironmentValue } from './developmentConvexEnvironment'
import type { DevelopmentHttpClient, RoomFrame } from './developmentHttpClient'

export type HeldEncounterSession = Extract<EncounterSessionFrameDto, { held: true }>
type ScenePoint = { x: number; y: number }
type PreviewReceipt = {
  userId: string
  tokenId: string
  sequence: number
  receivedAt: number
}

const WAIT_MS = 15_000

/**
 * One member's view of one Campaign's room, kept from the frames the room pushes: the held Encounter
 * session, the Scene version, and when each frame arrived (`performance.now()`). A measured window
 * reads state from here and never from Convex.
 */
export class RoomWatch {
  /** Every held Encounter session version this member's socket received, in arrival order. */
  readonly sessionMarks: { version: number; receivedAt: number }[] = []
  /** When each COMMAND_COMMITTED frame arrived, by command ID. */
  readonly commits = new Map<string, number>()
  readonly previews: PreviewReceipt[] = []
  #session: HeldEncounterSession | null = null
  #scene: { id: string; version: number }
  readonly #waiters = new Set<() => void>()

  private constructor(
    readonly client: DevelopmentHttpClient,
    readonly campaignId: string,
    readonly userId: string,
    scene: { id: string; version: number }
  ) {
    this.#scene = scene
  }

  /**
   * Looks up the Campaign, joins its room and subscribes to its Encounter session, keeping every
   * frame from the join on. `sceneVersion` is the Scene's version when the room is joined; the room
   * sends the Scene only once a member has synchronized it, so later versions come from its deltas.
   * Resolves once the room has sent the held session.
   */
  static async join(
    client: DevelopmentHttpClient,
    userId: string,
    input: { encounterId: string; sceneId: string; sceneVersion: number }
  ): Promise<RoomWatch> {
    const early: RoomFrame[] = []
    const stopBuffering = client.onRoomFrame((frame) => early.push(frame))
    const campaignId = await client.warmRoom(input)
    stopBuffering()
    const watch = new RoomWatch(client, campaignId, userId, {
      id: input.sceneId,
      version: input.sceneVersion
    })
    for (const frame of early) watch.#accept(frame)
    client.onRoomFrame((frame) => watch.#accept(frame))
    client.subscribeEncounterSession(campaignId, false)
    await watch.until(() => watch.#session, 'its held Encounter session')
    return watch
  }

  /** Resolves with the first non-null `read()`, re-checked on every frame; rejects after `timeoutMs`. */
  until<T>(read: () => T | null, what: string, timeoutMs = WAIT_MS): Promise<T> {
    return new Promise((resolve, reject) => {
      const settle = () => {
        clearTimeout(timer)
        this.#waiters.delete(check)
      }
      const check = () => {
        try {
          const value = read()
          if (value === null) return
          settle()
          resolve(value)
        } catch (error) {
          settle()
          reject(error)
        }
      }
      const timer = setTimeout(() => {
        settle()
        reject(new Error(`V15 member ${this.userId} did not receive ${what} in ${timeoutMs} ms.`))
      }, timeoutMs)
      this.#waiters.add(check)
      check()
    })
  }

  /** The held session at `minimumVersion` or later. */
  session(minimumVersion: number): Promise<HeldEncounterSession> {
    return this.until(
      () => (this.#session && this.#session.version >= minimumVersion ? this.#session : null),
      `Encounter session version ${minimumVersion}`
    )
  }

  /** The GM's projection of the Run at `minimumVersion` or later. */
  async run(minimumVersion: number) {
    return encounterGmProjectionDtoSchema.parse(
      (await this.session(minimumVersion)).state.encounter
    )
  }

  /** The decision this member can see once `match` accepts it. */
  pending(match: (pending: PendingDecision) => boolean, what: string): Promise<PendingDecision> {
    return this.until(() => {
      const pending = this.#session?.state.pending
      return pending && match(pending) ? pending : null
    }, what)
  }

  /** When this member first received a held session at `version` or later, or null. */
  firstSessionAt(version: number): number | null {
    return this.sessionMarks.find((mark) => mark.version >= version)?.receivedAt ?? null
  }

  get held(): HeldEncounterSession | null {
    return this.#session
  }

  get scene(): { id: string; version: number } {
    return this.#scene
  }

  #accept({ campaignId, message, receivedAt }: RoomFrame): void {
    if (campaignId !== this.campaignId) return
    if (message.type === 'STATE_SYNC') {
      if (message.state.scene)
        this.#scene = { id: message.state.scene.id, version: message.state.scene.version }
    } else if (message.type === 'ENCOUNTER_SESSION') {
      this.#session = message.session.held ? message.session : null
      if (message.session.held)
        this.sessionMarks.push({ version: message.session.version, receivedAt })
    } else if (message.type === 'COMMAND_COMMITTED') {
      if (!this.commits.has(message.commandId)) this.commits.set(message.commandId, receivedAt)
      const { delta } = message
      if (delta?.scope === 'SCENE' && this.#scene.id === delta.result.sceneId)
        this.#scene = {
          id: this.#scene.id,
          version: Math.max(this.#scene.version, delta.result.version)
        }
      else if (delta?.scope === 'SCENE_VERSION' && this.#scene.id === delta.sceneId)
        this.#scene = { id: this.#scene.id, version: Math.max(this.#scene.version, delta.version) }
    } else if (
      message.type === 'TRANSIENT' &&
      message.message.envelope.kind === 'TOKEN_DRAG_PREVIEW'
    )
      this.previews.push({
        userId: message.message.userId,
        tokenId: message.message.envelope.tokenId,
        sequence: message.message.envelope.sequence,
        receivedAt
      })
    for (const check of [...this.#waiters]) check()
  }
}

type PendingDecision = NonNullable<HeldEncounterSession['state']['pending']>

/** Nearest-rank percentiles over raw milliseconds. */
export function latencySummary(values: readonly number[]) {
  if (values.length === 0) throw new Error('V15 timing has no samples.')
  const sorted = [...values].sort((left, right) => left - right)
  const rank = (quantile: number) => sorted[Math.ceil(quantile * sorted.length) - 1]!
  return {
    samples: sorted.length,
    p50Ms: rank(0.5),
    p95Ms: rank(0.95),
    p99Ms: rank(0.99),
    maximumMs: sorted.at(-1)!,
    rawMs: values
  }
}

/** One measured command: who sent it and the Run version its commit produced. */
export type MeasuredCommit = { commandId: string; initiator: RoomWatch; version: number }

/**
 * Warm convergence (V15.2). Anchored at the initiator's own COMMAND_COMMITTED frame, the room's
 * journal commit: for each measured commit, the slowest other member's first held Encounter session
 * at that Run version or later, with that member's COMMAND_COMMITTED for the same command as a
 * secondary series where the room sends one. All timestamps share this process's clock.
 */
export function measureConvergence(
  commits: readonly MeasuredCommit[],
  watches: readonly RoomWatch[]
) {
  const session: number[] = []
  const committed: number[] = []
  for (const { commandId, initiator, version } of commits) {
    const anchor = initiator.commits.get(commandId)
    if (anchor === undefined) throw new Error('V15 measured command has no commit frame.')
    const peers = watches.filter(
      (watch) => watch !== initiator && watch.campaignId === initiator.campaignId
    )
    session.push(
      Math.max(
        ...peers.map((peer) => {
          const at = peer.firstSessionAt(version)
          if (at === null)
            throw new Error(`V15 member ${peer.userId} never reached Run version ${version}.`)
          return at - anchor
        })
      )
    )
    const peerCommits = peers.flatMap((peer) => peer.commits.get(commandId) ?? [])
    if (peerCommits.length > 0) committed.push(Math.max(...peerCommits) - anchor)
  }
  return {
    session: latencySummary(session),
    commandCommitted: committed.length > 0 ? latencySummary(committed) : null
  }
}

/**
 * Token drag previews from one member to the rest of its Campaign. Each is a TRANSIENT the room must
 * accept (its baseline is the room's Scene version) and fan out; latency is from the send to each
 * peer's receipt, and a preview the room drops (no copy back to the sender) is counted, not timed.
 */
export class PreviewProbe {
  readonly latenciesMs: number[] = []
  dropped = 0
  #sequence = 0

  constructor(
    private readonly sender: RoomWatch,
    private readonly peers: readonly RoomWatch[],
    private readonly tokenId: string
  ) {}

  /** One drag: a preview per position, at no more than the room's 10 Hz per stream. */
  async drag(positions: readonly ScenePoint[]): Promise<void> {
    for (const position of positions) {
      const sequence = ++this.#sequence
      const { id: sceneId, version: baselineVersion } = this.sender.scene
      const sentAt = performance.now()
      this.sender.client.sendTransient(this.sender.campaignId, {
        audience: 'TABLE',
        baselineVersion,
        kind: 'TOKEN_DRAG_PREVIEW',
        position,
        sceneId,
        sequence,
        tokenId: this.tokenId
      })
      const received = (watch: RoomWatch) =>
        watch.previews.find(
          (preview) =>
            preview.userId === this.sender.userId &&
            preview.tokenId === this.tokenId &&
            preview.sequence === sequence
        ) ?? null
      try {
        await Promise.all(
          [this.sender, ...this.peers].map((watch) =>
            watch.until(() => received(watch), `token preview ${sequence}`, 2_000)
          )
        )
        for (const peer of this.peers) this.latenciesMs.push(received(peer)!.receivedAt - sentAt)
      } catch {
        this.dropped += 1
      }
      await new Promise((resolve) => setTimeout(resolve, 110))
    }
  }
}

/** The development-only Worker routes into one room, called with the Worker's control secret. */
export class RoomControl {
  readonly #workerUrl: URL
  readonly #secret: string

  private constructor(workerUrl: URL, secret: string) {
    this.#workerUrl = workerUrl
    this.#secret = secret
  }

  /** Reads the secret from the local Convex deployment once; it is never printed or stored. */
  static async open(client: DevelopmentHttpClient): Promise<RoomControl> {
    return new RoomControl(
      client.workerUrl(),
      await convexEnvironmentValue('LIVE_SESSION_WORKER_SECRET')
    )
  }

  /** The room meter's cumulative totals: `{ current, released }`. */
  async meter(campaignId: string): Promise<unknown> {
    return (await this.#call('GET', LIVE_SESSION_METER_PATH, campaignId)).json()
  }

  /** Publishes everything the room has committed to Convex; resolves with the sequence it holds. */
  async barrier(campaignId: string): Promise<{ publishedSequence: number; wallMs: number }> {
    const startedAt = performance.now()
    const body: unknown = await (
      await this.#call('POST', LIVE_SESSION_CHECKPOINT_BARRIER_PATH, campaignId)
    ).json()
    const wallMs = performance.now() - startedAt
    if (
      typeof body !== 'object' ||
      body === null ||
      !('publishedSequence' in body) ||
      typeof body.publishedSequence !== 'number'
    )
      throw new Error('The room barrier answered without a published sequence.')
    return { publishedSequence: body.publishedSequence, wallMs }
  }

  async #call(method: 'GET' | 'POST', path: string, campaignId: string): Promise<Response> {
    const url = new URL(this.#workerUrl)
    url.pathname = `${url.pathname.replace(/\/$/, '')}${path}/${campaignId}`
    const response = await fetch(url, {
      method,
      headers: { [LIVE_SESSION_CONTROL_SECRET_HEADER]: this.#secret }
    })
    if (!response.ok) throw new Error(`The room ${path} route answered ${response.status}.`)
    return response
  }
}
