import { RulesRevisionChangedError } from './nativeRulesRevisions.js'

/** Preparations repeated after an input changed under them, before the command is refused. */
export const MAX_PREPARATION_RETRIES = 2

type Random = (maximum: number) => number

/**
 * Prepare a command, repeating the whole attempt from refreshed inputs when an input changed
 * mid-preparation. An attempt writes nothing durable until its commit, so repeating it is safe; the
 * dice stay safe because every draw is recorded and replayed, so a repeat sees the draws the first
 * attempt saw and the outcome matches an undisturbed command. A repeat that needs a die the earlier
 * attempt never rolled (or a different size) draws fresh from the source from that point on.
 * Past the bound the error is rethrown and the member is told to try again.
 */
export async function retryPreparation<T>(
  random: Random,
  refresh: () => Promise<void>,
  attempt: (random: Random) => Promise<T>
): Promise<T> {
  const draws: { maximum: number; value: number }[] = []
  for (let retries = 0; ; retries += 1) {
    let next = 0
    const replay: Random = (maximum) => {
      const recorded = draws[next]
      if (recorded?.maximum === maximum) {
        next += 1
        return recorded.value
      }
      draws.length = next
      const value = random(maximum)
      draws.push({ maximum, value })
      next += 1
      return value
    }
    try {
      return await attempt(replay)
    } catch (error) {
      if (!(error instanceof RulesRevisionChangedError) || retries >= MAX_PREPARATION_RETRIES)
        throw error
      await refresh()
    }
  }
}
