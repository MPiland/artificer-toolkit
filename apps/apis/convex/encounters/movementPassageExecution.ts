import type { MutationCtx } from '../_generated/server'
import { nextRollInt } from '../lib/rollRandom'
import { createRulesRuntime } from '../rules/runtime'
import { prepareNativeMovementPassageContest } from './movementPassagePreparation'
import type { MovementTarget } from './movementTargets'
import { evaluateEncounterMovementPassageContest } from '@artificer-toolkit/rules-runtime/encounterMovementPassageExecution'

type ContestInput = Parameters<
  typeof evaluateEncounterMovementPassageContest<NonNullable<MovementTarget['characterFacts']>>
>[0] & { userId: string }

/** Evaluates sealed passage choice/evidence only; Scene publication owns all writes and economy use. */
export async function evaluateNativeMovementPassageContest(ctx: MutationCtx, input: ContestInput) {
  const { userId, ...contestInput } = input
  return evaluateEncounterMovementPassageContest(contestInput, {
    prepareContest: (prepared) => prepareNativeMovementPassageContest(ctx, { ...prepared, userId }),
    runtime: () => createRulesRuntime(ctx, userId),
    rollD20: () => nextRollInt(20) + 1
  })
}
