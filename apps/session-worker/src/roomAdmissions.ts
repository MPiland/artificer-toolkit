import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { decodeJwt } from 'jose'
import { callLiveSessionRoute, LiveSessionRouteError } from './liveSessionRoutes.js'
import { attachment, send, type Admission, type SocketAttachment } from './roomSocket.js'
import { admitsRoomMember } from './roomAuthorization.js'
import { ROOM_LIMITS } from './roomLimits.js'
import { verifiedAccessTokenSubject } from './accessTokenSubject.js'
import type { RoomCommandHost } from './roomCommandHost.js'
import type { RoomMeter } from './roomMeter.js'
import type { RoomStorageAuthority } from './roomStorageAuthority.js'

/** The room steps socket admission uses. */
export type RoomAdmissionsPort = Pick<
  RoomCommandHost,
  'authorization' | 'cache' | 'env' | 'flushOutbox' | 'presentationChanging' | 'setCache'
> & {
  readonly meter: RoomMeter
  readonly authority: Pick<RoomStorageAuthority, 'ensure' | 'recoverIfNeeded'>
  cacheGeneration(): number
  ensureSceneCache(value: SocketAttachment): Promise<void>
  refreshAuthorization(): Promise<LiveSessionRoomAuthorization>
  publishInBackground(): void
  sendStateSync(socket: WebSocket, admission: Admission): void
  queuePostCommit(): void
  refreshIdleRelease(leaving?: WebSocket): Promise<void>
  openSockets(except?: WebSocket): WebSocket[]
  /** Drops the Sheet, Encounter and Campaign summary feeds a socket subscribed to. */
  dropFeeds(socket: WebSocket): void
  /** Drops the rate-limit budgets and preview streams a closed socket held. */
  dropSocketState(socket: WebSocket): void
}

/**
 * The room's socket admission state: who is admitted and until when, which sign-ins are being
 * verified, each socket's generation (so a stale step never acts on a newer admission), and the
 * expiries that challenge or close a socket. A warm admission proves a fresh token locally; a cold
 * one waits behind the single cold admission in flight.
 */
export class RoomAdmissions {
  readonly #admissions = new Map<WebSocket, Admission>()
  readonly #authenticating = new Map<
    WebSocket,
    { accessToken: string; deadline: number; generation: number }
  >()
  readonly #generations = new Map<WebSocket, number>()
  /**
   * Sockets challenged ahead of their admission's expiry, with that expiry: a socket still not
   * re-admitted then is closed with a reason instead of lingering unadmitted (Amendment 23).
   */
  readonly #expiring = new Map<WebSocket, number>()
  /**
   * The cold admission in flight, settled (never rejected) when it ends. A woken room re-admits its
   * surviving sockets at once; they wait for this one cold admission and then admit warm.
   */
  #coldAdmission: Promise<void> | null = null

  constructor(private readonly port: RoomAdmissionsPort) {}

  /** Whether the socket holds an admission, live or not. */
  has(socket: WebSocket): boolean {
    return this.#admissions.has(socket)
  }

  /** The socket's admission as last recorded, live or not. */
  get(socket: WebSocket): Admission | undefined {
    return this.#admissions.get(socket)
  }

  /** The expiry a challenged socket must be re-admitted by, if it was challenged early. */
  expiry(socket: WebSocket): number | undefined {
    return this.#expiring.get(socket)
  }

  /**
   * Restores a surviving socket's admission from its attachment; a restore is not an admission event.
   * It arms no expiry: the attachment cannot tell whether the socket was challenged before the room
   * slept, so `reauthenticateExpiring` challenges it at its own lead time, even when the wake is that
   * alarm.
   */
  restore(socket: WebSocket, admission: Admission): void {
    this.#generations.set(socket, admission.generation)
    this.#admissions.set(socket, admission)
  }

  /** A token already inside the re-authentication window is not challenged again; it runs to expiry. */
  #trackExpiry(socket: WebSocket, deadline: number): void {
    if (deadline - ROOM_LIMITS.reauthenticationLeadMs > Date.now()) this.#expiring.delete(socket)
    else this.#expiring.set(socket, deadline)
  }

  /**
   * Challenges each admitted socket at its admission's expiry minus `reauthenticationLeadMs`, so the
   * client answers with a refreshed token. A socket not re-admitted by that expiry is closed with a
   * reason: a revoked session cannot obtain a token, so silence ends the socket here.
   */
  reauthenticateExpiring(): void {
    const now = Date.now()
    for (const socket of this.port.openSockets()) {
      const expiresAt = this.#expiring.get(socket)
      if (expiresAt !== undefined) {
        if (expiresAt <= now) this.closeSocket(socket, 'Live-session sign-in expired.')
        continue
      }
      const admission = this.#admissions.get(socket)
      if (!admission) continue
      if (admission.deadline <= now) this.closeSocket(socket, 'Live-session sign-in expired.')
      else if (admission.deadline - ROOM_LIMITS.reauthenticationLeadMs <= now) {
        this.challenge(socket, admission.generation)
        this.#expiring.set(socket, admission.deadline)
      }
    }
  }

  async authenticate(socket: WebSocket, accessToken: string): Promise<void> {
    const value = attachment(socket)
    if (!value) {
      socket.close(1008, 'Invalid live-session socket.')
      return
    }
    const pending = this.#authenticating.get(socket)
    if (
      pending?.accessToken === accessToken &&
      pending.generation === this.#generations.get(socket)
    )
      return
    const generation = this.invalidate(socket)
    if (this.port.presentationChanging()) return
    let cacheGeneration = this.port.cacheGeneration()
    let expiration: number
    try {
      const exp = decodeJwt(accessToken).exp
      if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0 || exp * 1_000 <= Date.now())
        throw new Error('Invalid token expiry.')
      expiration = exp
    } catch {
      this.challenge(socket, generation)
      return
    }
    if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000) {
      this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
      return
    }
    const deadline = expiration * 1_000
    this.#authenticating.set(socket, { accessToken, deadline, generation })
    let endColdAdmission: (() => void) | null = null
    try {
      // Warm admission (Amendment 18): an already-admitted socket's fresh token is proven locally
      // against the Convex site keys and its membership comes from the room's current lease, so it
      // costs no flush, capture or authorization read. Anything unproven takes the cold path below.
      if (value.membershipEpoch !== null) {
        const subject = await verifiedAccessTokenSubject(
          accessToken,
          this.port.env.CONVEX_SITE_URL,
          new Date(Date.now())
        )
        if (generation !== this.#generations.get(socket)) return
        if (subject !== null && subject !== value.authSubject) {
          this.#closeIfCurrent(socket, generation, 'Live-session identity changed.')
          return
        }
        if (
          subject !== null &&
          this.#coldAdmission &&
          !this.port.authorization.current(value.authorityEpoch)
        ) {
          await this.#coldAdmission
          if (generation !== this.#generations.get(socket)) return
          cacheGeneration = this.port.cacheGeneration()
        }
        const authorization =
          subject === null ? null : this.port.authorization.current(value.authorityEpoch)
        if (
          authorization &&
          admitsRoomMember(authorization, {
            membershipEpoch: value.membershipEpoch,
            role: value.role,
            userId: value.userId
          })
        ) {
          await this.port.ensureSceneCache(value)
          if (
            !this.port.cache() ||
            this.port.presentationChanging() ||
            cacheGeneration !== this.port.cacheGeneration()
          )
            this.challenge(socket, generation)
          else
            await this.#admit(socket, value, {
              deadline,
              generation,
              membershipEpoch: value.membershipEpoch,
              role: value.role,
              userId: value.userId
            })
          return
        }
      }
      if (!this.#coldAdmission) {
        let settle!: () => void
        const cold = new Promise<void>((resolve) => (settle = resolve))
        this.#coldAdmission = cold
        endColdAdmission = () => {
          if (this.#coldAdmission === cold) this.#coldAdmission = null
          settle()
        }
      }
      if (await this.port.authority.recoverIfNeeded(value.authorityEpoch)) return
      this.port.meter.epoch(value.authorityEpoch)
      // Reconnect reads the acknowledged product state after the room's pending prefix is saved.
      await this.port.flushOutbox('ADMISSION')
      const capture = await callLiveSessionRoute(this.port.env, accessToken, 'capture', {
        campaignId: value.campaignId,
        expectedRole: value.role,
        expectedUserId: value.userId
      })
      if (
        capture.origin.userId !== value.userId ||
        capture.origin.role !== value.role ||
        (value.membershipEpoch !== null && capture.origin.membershipEpoch !== value.membershipEpoch)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      if (capture.campaignId !== value.campaignId) {
        this.challenge(socket, generation)
        return
      }
      await this.port.authority.ensure(
        value,
        accessToken,
        capture.origin.role,
        capture.origin.userId,
        capture.sceneHeader?.id ?? null
      )
      // Each (re-)authentication renews the room's authorization lease with one revisions read.
      const authorization = await this.port.refreshAuthorization()
      if (generation !== this.#generations.get(socket)) return
      if (!admitsRoomMember(authorization, capture.origin)) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      if (this.port.presentationChanging() || cacheGeneration !== this.port.cacheGeneration()) {
        this.challenge(socket, generation)
        return
      }
      const cached = this.port.cache()
      if (cached?.scene) {
        if (
          capture.sceneEncounterId !== cached.encounterId ||
          capture.sceneHeader?.id !== cached.scene.id ||
          capture.sceneHeader.version !== cached.scene.version ||
          capture.presentation?.sceneId !== cached.scene.id
        )
          this.port.setCache(null)
        else
          this.port.setCache({
            ...cached,
            presentation: {
              expectedPresentationVersion: capture.presentation.version
            }
          })
      }
      await this.port.ensureSceneCache(value)
      if (
        !this.port.cache() ||
        this.port.presentationChanging() ||
        cacheGeneration !== this.port.cacheGeneration()
      ) {
        this.challenge(socket, generation)
        return
      }
      if (
        await this.#admit(socket, value, {
          deadline,
          generation,
          membershipEpoch: capture.origin.membershipEpoch,
          role: capture.origin.role,
          userId: capture.origin.userId
        })
      )
        this.port.publishInBackground()
    } catch (error) {
      if (
        error instanceof LiveSessionRouteError &&
        (error.status === 401 || error.status === 409)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      // A challenge makes the client authenticate again at once, so a failure that does not change
      // between attempts would loop. Closing hands the retry to the client's backoff instead. The
      // close reason names no cause, so the cause is logged.
      console.error('Live Session activation failed.', error)
      this.#closeIfCurrent(socket, generation, 'Live-session activation failed.')
    } finally {
      endColdAdmission?.()
      if (this.#authenticating.get(socket)?.generation === generation)
        this.#authenticating.delete(socket)
    }
  }

  /** Admits the socket unless its token, ticket, generation or membership went stale; true once announced. */
  async #admit(socket: WebSocket, value: SocketAttachment, admitted: Admission): Promise<boolean> {
    const { generation } = admitted
    if (
      Date.now() >= admitted.deadline ||
      generation !== this.#generations.get(socket) ||
      (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000)
    ) {
      if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000)
        this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
      else this.challenge(socket, generation)
      return false
    }
    const latest = attachment(socket)
    if (
      !latest ||
      (latest.membershipEpoch !== null && latest.membershipEpoch !== admitted.membershipEpoch)
    ) {
      this.challenge(socket, generation)
      return false
    }
    if (socket.readyState !== WebSocket.OPEN || this.#generations.get(socket) !== generation)
      return false
    socket.serializeAttachment({
      ...latest,
      admissionDeadline: admitted.deadline,
      membershipEpoch: admitted.membershipEpoch
    })
    this.#admissions.set(socket, admitted)
    this.#trackExpiry(socket, admitted.deadline)
    this.port.meter.admitted(
      admitted.userId,
      [...this.#admissions].filter(
        ([open, member]) => member.userId === admitted.userId && open.readyState === WebSocket.OPEN
      ).length
    )
    const current = this.liveAdmission(socket)
    if (
      current?.generation !== admitted.generation ||
      current.role !== admitted.role ||
      current.membershipEpoch !== admitted.membershipEpoch
    )
      return false
    send(socket, { campaignId: value.campaignId, type: 'TRANSIENT_READY' })
    this.port.sendStateSync(socket, current)
    this.port.queuePostCommit()
    // A reconnect inside the idle window cancels the pending release.
    await this.port.refreshIdleRelease()
    return true
  }

  liveAdmission(socket: WebSocket): Admission | null {
    const current = this.#admissions.get(socket)
    if (!current || !this.#isLive(current)) {
      this.#admissions.delete(socket)
      return null
    }
    return current
  }

  #isLive(admission: Admission): boolean {
    return Date.now() < admission.deadline
  }

  invalidate(socket: WebSocket): number {
    const generation = (this.#generations.get(socket) ?? 0) + 1
    this.#generations.set(socket, generation)
    this.#admissions.delete(socket)
    this.#authenticating.delete(socket)
    this.port.dropFeeds(socket)
    // A challenged or closed socket must not be restored by a later wake.
    const value = socket.readyState === WebSocket.OPEN ? attachment(socket) : null
    if (value && (value.admissionDeadline !== null || value.feeds !== null))
      socket.serializeAttachment({
        ...value,
        admissionDeadline: null,
        feeds: null
      })
    return generation
  }

  challenge(socket: WebSocket, expectedGeneration?: number): void {
    if (expectedGeneration !== undefined && this.#generations.get(socket) !== expectedGeneration)
      return
    // Traffic arriving while admission is being verified must not cancel that verification.
    const pending = this.#authenticating.get(socket)
    if (
      expectedGeneration === undefined &&
      !this.#admissions.has(socket) &&
      pending &&
      pending.generation === this.#generations.get(socket) &&
      Date.now() < pending.deadline
    )
      return
    this.invalidate(socket)
    send(socket, { type: 'AUTHENTICATION_REQUIRED' })
  }

  #closeIfCurrent(socket: WebSocket, expectedGeneration: number, reason: string): void {
    if (this.#generations.get(socket) === expectedGeneration) this.closeSocket(socket, reason)
  }

  closeSocket(socket: WebSocket, reason: string): void {
    this.forgetSocket(socket)
    if (socket.readyState === WebSocket.OPEN) socket.close(1008, reason)
  }

  forgetSocket(socket: WebSocket): void {
    this.invalidate(socket)
    this.#expiring.delete(socket)
    this.port.dropSocketState(socket)
  }
}
