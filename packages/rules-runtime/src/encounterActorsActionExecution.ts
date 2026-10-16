import type { CharacterHitPointOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import { createFrozenRollTape } from './encounterAreaActionExecution.js'
import { encounterChosenActorEntries } from './encounterAreaPending.js'
import { nextRollInt } from './random.js'

type ActorsActionSource = Pick<
  Parameters<typeof advanceNativeActionGraphs>[0],
  'runtime' | 'adapter' | 'plan' | 'occurrenceId'
> & { random?: (maximum: number) => number }

type ActorsBinding = Parameters<typeof advanceNativeActionGraphs>[0]['binding']

/**
 * Resolves a list of chosen creatures in one go: the action's single graph runs on each entry under
 * an occurrence id derived from the cast's and its own. A list that names each creature once
 * (Mass Healing Word) rolls its dice once for the whole list, and a creature whose outcome would roll
 * a different die than the first one's is refused. A projectile list (Magic Missile) may name a
 * creature again; each entry is one projectile that rolls on its own and lands on the hit points the
 * creature's earlier entries left it. An outcome that asks anyone for evidence is refused.
 */
export async function executeEncounterActorsAction(
  input: ActorsActionSource & {
    rollsPerTarget: boolean
    targets: readonly { actorId: string; binding: ActorsBinding }[]
  }
) {
  const entries = encounterChosenActorEntries(
    input.occurrenceId,
    input.targets.map((target) => target.actorId)
  )
  const random = input.random ?? nextRollInt
  const sharedRolls = createFrozenRollTape(random)
  const bindings = new Map<string, ActorsBinding>()
  const settled = []
  for (const [index, target] of input.targets.entries()) {
    const { occurrenceId } = entries[index]!
    const result = await advanceNativeActionGraphs({
      ...input,
      occurrenceId,
      binding: bindings.get(target.actorId) ?? target.binding,
      autoRoll: { SOURCE: true, TARGET: false },
      afterTest: async () => undefined,
      random: input.rollsPerTarget ? createFrozenRollTape(random)() : sharedRolls()
    })
    if (result.kind !== 'COMPLETE')
      throw new Error('A chosen-creature outcome cannot ask for evidence beyond its dice.')
    const lastHitPointOutcome = result.applications
      .filter(
        (application): application is CharacterHitPointOutcomeApplication =>
          'afterCurrentHitPoints' in application
      )
      .pop()
    if (lastHitPointOutcome)
      bindings.set(target.actorId, {
        ...(bindings.get(target.actorId) ?? target.binding),
        currentHitPoints: lastHitPointOutcome.afterCurrentHitPoints,
        temporaryHitPoints: lastHitPointOutcome.afterTemporaryHitPoints
      })
    settled.push({ actorId: target.actorId, occurrenceId, complete: result })
  }
  return settled
}
