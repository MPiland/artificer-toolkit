import type { LiveSessionTestRollsInputDto } from '@artificer-toolkit/schema/api/liveSessions'

/**
 * The dice a local-development test queued for one room. The room consults it only when
 * `isLocalDevelopment` holds; it is in memory, so a room that restarts rolls the platform's dice again.
 */
export class RoomTestDice {
  #rolls: number[] = []
  #repeat: number | null = null

  replace({ rolls, repeat }: LiveSessionTestRollsInputDto): void {
    this.#rolls = [...rolls]
    this.#repeat = repeat ?? null
  }

  /** The next queued roll, else the repeat value; null leaves the roll to the platform's dice. */
  next(): number | null {
    return this.#rolls.shift() ?? this.#repeat
  }
}
