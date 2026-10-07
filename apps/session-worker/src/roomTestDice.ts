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

  /**
   * The next queued roll, else the repeat value; null leaves the roll to the platform's dice.
   * A roll is a raw draw in `[0, maximum)` like the platform's dice, so one outside it fails loudly.
   */
  next(maximum: number): number | null {
    const roll = this.#rolls.shift() ?? this.#repeat
    if (roll !== null && roll >= maximum)
      throw new Error(`Queued test roll ${roll} is outside the die range 0 to ${maximum - 1}.`)
    return roll
  }
}
