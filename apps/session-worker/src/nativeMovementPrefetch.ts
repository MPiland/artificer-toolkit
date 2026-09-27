import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { movementDecisionSubject } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import type { LiveSessionMovementPrefetch } from '@artificer-toolkit/schema/api/liveSessionMovementAnswer'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

/**
 * The capture bundles the room read for the movement decision it holds (D64), one per member who
 * may answer it, read when the decision was issued. Only the latest decision's reads are kept; an
 * answer takes its member's read once, so a refused answer falls back to the stage. A read Convex
 * refused (a member who may not answer) or that failed is simply absent.
 */
export class MovementPrefetches {
  #occurrenceId: string | null = null
  readonly #reads = new Map<string, Promise<LiveSessionMovementPrefetch | null>>()

  clear(): void {
    this.#occurrenceId = null
    this.#reads.clear()
  }

  /** Starts each member's read for a newly issued decision, replacing any earlier decision's. */
  issue(
    occurrenceId: string,
    members: ReadonlyArray<{ userId: string; read(): Promise<LiveSessionMovementPrefetch> }>
  ): void {
    this.clear()
    this.#occurrenceId = occurrenceId
    for (const member of members)
      this.#reads.set(
        member.userId,
        member.read().catch(() => null)
      )
  }

  /**
   * The member's prefetched read for exactly this answer: its decision at the answer's versions and
   * no app roll (a SYSTEM_ROLL answer settles faces rolled after the decision was issued). Null
   * when there is none; an in-flight read is awaited, since it started before the answer.
   */
  async take(
    userId: string,
    answer: ResolveRuleOccurrenceInputDto
  ): Promise<LiveSessionMovementPrefetch | null> {
    const read = this.#reads.get(userId)
    if (!read || this.#occurrenceId !== answer.occurrenceId.toLowerCase()) return null
    this.#reads.delete(userId)
    const prefetch = await read
    return prefetch &&
      prefetch.expectedVersion === answer.expectedVersion &&
      checksumCanonicalJson(prefetch.movement.subject) ===
        checksumCanonicalJson(movementDecisionSubject(answer))
      ? prefetch
      : null
  }
}
