import {
  spatialTokensInsideArea,
  spatialTokensWithinSpaceRadius,
  type ScenePoint,
  type SpatialAreaShape,
  type SpatialSceneToken
} from '@artificer-toolkit/shared/vtt'

import {
  continueNativeActionAfterTest,
  prepareNativeActionTest,
  type EncounterActionAutoRoll,
  type PendingNativeActionGraphs,
  type ResumedNativeActionGraphs
} from './encounterActionExecution.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import { encounterAreaTargetOccurrenceId } from './encounterAreaPending.js'
import { nextRollInt } from './random.js'

type NativeActionInput = Parameters<typeof prepareNativeActionTest>[0]
type TestBoundary = Exclude<
  Awaited<ReturnType<typeof prepareNativeActionTest>>,
  PendingNativeActionGraphs
>
export type EncounterAreaLegendaryResistanceAudit = NonNullable<
  Parameters<typeof continueNativeActionAfterTest>[0]['legendaryResistance']
>

/**
 * What every caught creature shares: one rules runtime, plan, adapter and area occurrence. Each
 * creature's save runs under an occurrence id derived from the area's and its own.
 */
type AreaActionSource = Pick<NativeActionInput, 'runtime' | 'adapter' | 'plan' | 'occurrenceId'> & {
  random?: (maximum: number) => number
}

/** A caught creature: its own facts and the preference of the roller who answers its save. */
export type EncounterAreaTarget = {
  actorId: string
  binding: NativeActionInput['binding']
  /** What the creature's save has of the origin's sight, when its roller is shown a belief of it. */
  attackSight?: NativeActionInput['attackSight']
  autoRoll: EncounterActionAutoRoll
  /** The creature's Legendary Resistance on its current pool, asked for only once its save has failed. */
  discoverLegendaryResistance: () => Promise<EncounterLegendaryResistanceCandidate | null>
}

/**
 * One caught creature's save: awaiting its roller, or answered and sealed. A failed save carries the
 * Legendary Resistance its creature may use, which must be decided before the area settles.
 */
export type EncounterAreaTargetTest =
  | { actorId: string; kind: 'PENDING'; pending: PendingNativeActionGraphs }
  | {
      actorId: string
      kind: 'TESTED'
      boundary: TestBoundary
      legendaryResistance: EncounterLegendaryResistanceCandidate | null
    }

/**
 * The actors with a token sharing area with an area, in token-id order, each once. A point area
 * catches the caster and allies like anyone else; a directed area starts on the caster's own space
 * (the first token bound to them), never catches it, and needs it (`spatialTokensInsideArea`). A
 * caster-centered radius (`fromCasterSpace`) is measured from the edge of the caster's space, never
 * catches the caster, and needs its token (`spatialTokensWithinSpaceRadius`, D114).
 */
export function catchEncounterAreaActorIds(input: {
  origin: ScenePoint
  shape: SpatialAreaShape
  casterActorId: string
  tokens: readonly (SpatialSceneToken & { actorId: string })[]
  fromCasterSpace?: boolean
}): string[] {
  const { origin, shape, tokens } = input
  const casterToken = tokens.find((token) => token.actorId === input.casterActorId)
  const tokenIds =
    input.fromCasterSpace && shape.kind === 'RADIUS'
      ? spatialTokensWithinSpaceRadius({
          radius: shape.radius,
          tokens,
          casterTokenId: casterToken?.id
        })
      : spatialTokensInsideArea({ origin, shape, tokens, casterTokenId: casterToken?.id })
  const actorByTokenId = new Map(tokens.map((token) => [token.id, token.actorId]))
  const caught = new Set(tokenIds.map((tokenId) => actorByTokenId.get(tokenId)!))
  return [...caught]
}

function requireDistinctTargets(targets: readonly EncounterAreaTarget[]) {
  if (new Set(targets.map((target) => target.actorId)).size !== targets.length)
    throw new Error('An area action catches each creature once.')
}

async function testTarget(
  source: AreaActionSource,
  target: EncounterAreaTarget,
  resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
): Promise<EncounterAreaTargetTest> {
  const resistance: { candidate: EncounterLegendaryResistanceCandidate | null } = {
    candidate: null
  }
  const result = await prepareNativeActionTest({
    ...source,
    occurrenceId: encounterAreaTargetOccurrenceId(source.occurrenceId, target.actorId),
    binding: target.binding,
    attackSight: target.attackSight,
    autoRoll: target.autoRoll,
    // Runs after any completed TEST, whether it was answered or rolled for the creature.
    afterTest: async (execution) => {
      if (execution.outputs.resultPath === 'ON_SAVE_FAIL')
        resistance.candidate = await target.discoverLegendaryResistance()
    },
    ...(resume ? { resume } : {})
  })
  return result.kind === 'PENDING'
    ? { actorId: target.actorId, kind: 'PENDING', pending: result }
    : {
        actorId: target.actorId,
        kind: 'TESTED',
        boundary: result,
        legendaryResistance: resistance.candidate
      }
}

/** Opens every caught creature's save at once; none is rolled for it and no damage is rolled. */
export async function prepareEncounterAreaTests(
  source: AreaActionSource & { targets: readonly EncounterAreaTarget[] }
): Promise<EncounterAreaTargetTest[]> {
  requireDistinctTargets(source.targets)
  const tests: EncounterAreaTargetTest[] = []
  for (const target of source.targets) tests.push(await testTarget(source, target))
  return tests
}

/** Answers one creature's save, whatever the others have answered; the rest are left as they were. */
export async function answerEncounterAreaTest(
  input: AreaActionSource & {
    target: EncounterAreaTarget
    tests: readonly EncounterAreaTargetTest[]
    resolution: EncounterEvidenceAnswer
  }
): Promise<EncounterAreaTargetTest[]> {
  const current = input.tests.find((test) => test.actorId === input.target.actorId)
  if (current?.kind !== 'PENDING') throw new Error('This area save is not awaiting an answer.')
  const answered = await testTarget(input, input.target, {
    pending: current.pending,
    resolution: input.resolution
  })
  return input.tests.map((test) => (test === current ? answered : test))
}

/**
 * Damage is rolled once for the whole area: the first creature to need die n rolls it and every
 * later creature replays it. A creature whose outcome would roll a different die there is refused.
 */
export function createFrozenRollTape(random: (maximum: number) => number) {
  const rolls: { maximum: number; value: number }[] = []
  return () => {
    let index = 0
    return (maximum: number) => {
      const recorded = rolls[index]
      index += 1
      if (!recorded) {
        const value = random(maximum)
        rolls.push({ maximum, value })
        return value
      }
      if (recorded.maximum !== maximum)
        throw new Error('The frozen area damage does not fit this creature’s outcome.')
      return recorded.value
    }
  }
}

/**
 * Settles the whole area once every save is answered: each creature takes the outcome its own save
 * selected, with its own resistance, immunity and vulnerability, from damage frozen across them.
 * A creature may carry a Legendary Resistance decision sealed against its own failed save.
 */
export async function settleEncounterAreaAction(
  input: AreaActionSource & {
    targets: readonly EncounterAreaTarget[]
    tests: readonly EncounterAreaTargetTest[]
    legendaryResistance?: ReadonlyMap<string, EncounterAreaLegendaryResistanceAudit>
  }
) {
  requireDistinctTargets(input.targets)
  if (
    input.tests.length !== input.targets.length ||
    input.tests.some((test) => test.kind !== 'TESTED')
  )
    throw new Error('Every caught creature must answer its save before the area settles.')
  if (
    input.tests.some(
      (test) =>
        test.kind === 'TESTED' &&
        test.legendaryResistance &&
        !input.legendaryResistance?.has(test.actorId)
    )
  )
    throw new Error('A Legendary Resistance choice is undecided; the area cannot settle.')
  const frozenRolls = createFrozenRollTape(input.random ?? nextRollInt)
  const settled = []
  for (const target of input.targets) {
    const test = input.tests.find((entry) => entry.actorId === target.actorId)
    if (test?.kind !== 'TESTED') throw new Error('The area save is unavailable.')
    const occurrenceId = encounterAreaTargetOccurrenceId(input.occurrenceId, target.actorId)
    const result = await continueNativeActionAfterTest({
      ...input,
      occurrenceId,
      binding: target.binding,
      // The roller of a nested save would pause here: only the frozen damage may be rolled.
      autoRoll: { SOURCE: true, TARGET: false },
      afterTest: async () => undefined,
      random: frozenRolls(),
      boundary: test.boundary,
      legendaryResistance: input.legendaryResistance?.get(target.actorId) ?? null
    })
    if (result.kind !== 'COMPLETE')
      throw new Error('An area outcome cannot ask for evidence beyond its frozen damage.')
    settled.push({ actorId: target.actorId, occurrenceId, complete: result })
  }
  return settled
}
