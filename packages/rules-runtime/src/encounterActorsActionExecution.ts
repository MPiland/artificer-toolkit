import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import { createFrozenRollTape } from './encounterAreaActionExecution.js'
import { encounterAreaTargetOccurrenceId } from './encounterAreaPending.js'
import { nextRollInt } from './random.js'

type ActorsActionSource = Pick<
  Parameters<typeof advanceNativeActionGraphs>[0],
  'runtime' | 'adapter' | 'plan' | 'occurrenceId'
> & { random?: (maximum: number) => number }

/**
 * Resolves a list of chosen creatures (Mass Healing Word) in one go: the action's single graph runs
 * on each creature under an occurrence id derived from the cast's and its own, from dice the system
 * rolls once for the whole list. A creature whose outcome would roll a different die than the first
 * one's is refused, and so is an outcome that asks anyone for evidence.
 */
export async function executeEncounterActorsAction(
  input: ActorsActionSource & {
    targets: readonly {
      actorId: string
      binding: Parameters<typeof advanceNativeActionGraphs>[0]['binding']
    }[]
  }
) {
  if (new Set(input.targets.map((target) => target.actorId)).size !== input.targets.length)
    throw new Error('A chosen-creature action names each creature once.')
  const frozenRolls = createFrozenRollTape(input.random ?? nextRollInt)
  const settled = []
  for (const target of input.targets) {
    const result = await advanceNativeActionGraphs({
      ...input,
      occurrenceId: encounterAreaTargetOccurrenceId(input.occurrenceId, target.actorId),
      binding: target.binding,
      autoRoll: { SOURCE: true, TARGET: false },
      afterTest: async () => undefined,
      random: frozenRolls()
    })
    if (result.kind !== 'COMPLETE')
      throw new Error('A chosen-creature outcome cannot ask for evidence beyond its dice.')
    settled.push({ actorId: target.actorId, complete: result })
  }
  return settled
}
