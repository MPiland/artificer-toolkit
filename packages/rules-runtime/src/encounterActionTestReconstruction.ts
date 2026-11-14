import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { prepareNativeActionTest } from './encounterActionExecution.js'
import { sealedTestDice, type NativeActionBaseInput } from './encounterActionTestBoundary.js'

/**
 * Rebuilds a sealed TEST boundary from current facts and the recorded faces, without rolling again.
 * Omitting `execution` re-evaluates the recorded dice against the given binding (a sealed reaction
 * adjustment); every other caller proves the rebuilt execution equals the retained one.
 */
export async function reconstructNativeActionTest(
  input: Pick<
    NativeActionBaseInput,
    'runtime' | 'adapter' | 'plan' | 'occurrenceId' | 'binding'
  > & {
    execution?: ServerCompletedRuleExecutionDto
    d20: Pick<
      ServerRuleExecutionD20EvidenceDto,
      | 'requestId'
      | 'rawFaces'
      | 'rollMode'
      | 'keep'
      | 'selectedNatural'
      | 'modeAdjustment'
      | 'addedDice'
    >
  }
) {
  const source: NativeActionBaseInput = {
    runtime: input.runtime,
    adapter: input.adapter,
    plan: input.plan,
    occurrenceId: input.occurrenceId,
    binding: input.binding,
    autoRoll: { SOURCE: false, TARGET: false },
    afterTest: async () => undefined,
    random: () => {
      throw new Error('Retained TEST evidence must not roll again.')
    }
  }
  const pending = await prepareNativeActionTest(source)
  if (pending.kind !== 'PENDING' || pending.continuation.request.requestId !== input.d20.requestId)
    throw new Error('The retained TEST request is stale.')
  // The policy's dice were rolled beside the d20 (D156) and are recorded first. Every other added die
  // joined the roll after it: a window spent it, or a reaction's own action rolled it (D219).
  const recorded = input.d20.addedDice ?? []
  const besideDice = recorded
    .filter(({ spentEffectId }) => !spentEffectId)
    .slice(0, pending.d20Policy?.addedDice?.length ?? 0)
  const windowDice = recorded.filter((die) => !besideDice.includes(die))
  const addedFaces = besideDice.flatMap((die) => die.rolledFaces)
  const boundary = await prepareNativeActionTest({
    ...source,
    windowDice,
    // The retained execution holds the dice its TEST rolled after the d20; they are read back, not rolled.
    ...(input.execution
      ? { testDice: sealedTestDice({ execution: input.execution, d20: input.d20 }) }
      : {}),
    resume: {
      pending,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: input.d20.requestId,
        rawFaces: input.d20.rawFaces,
        rollMode: input.d20.rollMode,
        ...(addedFaces.length > 0 ? { addedFaces } : {})
      }
    }
  })
  if (
    boundary.kind !== 'TEST_BOUNDARY' ||
    boundary.d20.rollMode !== input.d20.rollMode ||
    boundary.d20.keep !== input.d20.keep ||
    boundary.d20.selectedNatural !== input.d20.selectedNatural ||
    (input.execution !== undefined &&
      checksumRuleDocument(boundary.execution) !== checksumRuleDocument(input.execution))
  )
    throw new Error('The retained TEST execution is stale.')
  // The recorded faces are already settled, so replaying them cannot rediscover a sight adjustment.
  return input.d20.modeAdjustment
    ? { ...boundary, d20: { ...boundary.d20, modeAdjustment: input.d20.modeAdjustment } }
    : boundary
}
