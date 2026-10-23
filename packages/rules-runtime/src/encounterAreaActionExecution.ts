import {
  spatialTokensInsideArea,
  spatialTokensWithinSpaceRadius,
  type ScenePoint,
  type SpatialAreaShape,
  type SpatialSceneToken
} from '@artificer-toolkit/shared/vtt'

import type { CharacterHitPointOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import {
  continueNativeActionAfterTest,
  prepareNativeActionTest,
  type EncounterActionAutoRoll,
  type PendingNativeActionGraphs,
  type ResumedNativeActionGraphs
} from './encounterActionExecution.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
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

/**
 * One entry the action reaches: a caught creature, or one ray aimed at a creature a further ray is
 * aimed at too. It has its own facts, its own occurrence and the preference of the roller who answers
 * its roll (the creature for a save, the caster for an attack).
 */
export type EncounterAreaTarget = {
  actorId: string
  /** The occurrence the entry's sealed roll and outcome run under (`encounterChosenActorEntries`). */
  occurrenceId: string
  binding: NativeActionInput['binding']
  /**
   * The binding the outcome runs on when the creature already took damage earlier in the same commit
   * than the one its roll was sealed against (a creature a mover struck, D159).
   */
  currentBinding?: NativeActionInput['binding']
  /** What the creature's save has of the origin's sight, when its roller is shown a belief of it. */
  attackSight?: NativeActionInput['attackSight']
  autoRoll: EncounterActionAutoRoll
  /** The creature's Legendary Resistance on its current pool, asked for only once its save has failed. */
  discoverLegendaryResistance: () => Promise<EncounterLegendaryResistanceCandidate | null>
}

/**
 * One entry's roll: awaiting its roller, or answered and sealed. A failed save carries the
 * Legendary Resistance its creature may use, which must be decided before the area settles.
 */
export type EncounterAreaTargetTest =
  | { actorId: string; occurrenceId: string; kind: 'PENDING'; pending: PendingNativeActionGraphs }
  | {
      actorId: string
      occurrenceId: string
      kind: 'TESTED'
      boundary: TestBoundary
      legendaryResistance: EncounterLegendaryResistanceCandidate | null
    }

/** The actors that are out of play, whom no area catches (D178). */
export function absentEncounterActorIds(
  actors: readonly { id: string; absence: unknown }[]
): ReadonlySet<string> {
  return new Set(actors.filter((actor) => actor.absence !== null).map((actor) => actor.id))
}

/**
 * The actors with a token sharing area with an area, in token-id order, each once. A point area
 * catches the caster and allies like anyone else; a directed area starts on the caster's own space
 * (the first token bound to them), never catches it, and needs it (`spatialTokensInsideArea`). A
 * caster-centered radius (`fromCasterSpace`) is measured from the edge of the caster's space, never
 * catches the caster, and needs its token (`spatialTokensWithinSpaceRadius`, D114). The caster's own
 * space (`fromCasterSpace` over a cube) catches those sharing it.
 */
export function catchEncounterAreaActorIds(input: {
  origin: ScenePoint
  shape: SpatialAreaShape
  casterActorId: string
  tokens: readonly (SpatialSceneToken & { actorId: string })[]
  fromCasterSpace?: boolean
  /** Actors out of play keep their tokens but are caught by nothing (D178). */
  absentActorIds?: ReadonlySet<string>
}): string[] {
  const { origin, shape } = input
  const tokens = input.tokens.filter((token) => !input.absentActorIds?.has(token.actorId))
  const casterToken = tokens.find((token) => token.actorId === input.casterActorId)
  const tokenIds =
    input.fromCasterSpace && shape.kind === 'RADIUS'
      ? spatialTokensWithinSpaceRadius({
          radius: shape.radius,
          tokens,
          casterTokenId: casterToken?.id
        })
      : spatialTokensInsideArea({ origin, shape, tokens, casterTokenId: casterToken?.id }).filter(
          // The caster's own space catches those sharing it, never the caster.
          (tokenId) => !input.fromCasterSpace || tokenId !== casterToken?.id
        )
  const actorByTokenId = new Map(tokens.map((token) => [token.id, token.actorId]))
  const caught = new Set(tokenIds.map((tokenId) => actorByTokenId.get(tokenId)!))
  return [...caught]
}

function requireDistinctEntries(targets: readonly EncounterAreaTarget[]) {
  if (new Set(targets.map((target) => target.occurrenceId)).size !== targets.length)
    throw new Error('An area action reaches each entry once.')
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
    occurrenceId: target.occurrenceId,
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
    ? {
        actorId: target.actorId,
        occurrenceId: target.occurrenceId,
        kind: 'PENDING',
        pending: result
      }
    : {
        actorId: target.actorId,
        occurrenceId: target.occurrenceId,
        kind: 'TESTED',
        boundary: result,
        legendaryResistance: resistance.candidate
      }
}

/** Opens every entry's roll at once; none is rolled for it and no damage is rolled. */
export async function prepareEncounterAreaTests(
  source: AreaActionSource & { targets: readonly EncounterAreaTarget[] }
): Promise<EncounterAreaTargetTest[]> {
  requireDistinctEntries(source.targets)
  const tests: EncounterAreaTargetTest[] = []
  for (const target of source.targets) tests.push(await testTarget(source, target))
  return tests
}

/** Answers one entry's roll, whatever the others have answered; the rest are left as they were. */
export async function answerEncounterAreaTest(
  input: AreaActionSource & {
    target: EncounterAreaTarget
    tests: readonly EncounterAreaTargetTest[]
    resolution: EncounterEvidenceAnswer
  }
): Promise<EncounterAreaTargetTest[]> {
  const current = input.tests.find((test) => test.occurrenceId === input.target.occurrenceId)
  if (current?.kind !== 'PENDING') throw new Error('This area roll is not awaiting an answer.')
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
 * The binding a creature's next entry finds it with: the hit points its latest hit point outcome
 * left it, or the binding it had when it has none.
 */
export function bindingAfterHitPoints<Binding extends object>(
  binding: Binding,
  applications: readonly object[]
): Binding {
  const last = applications
    .filter(
      (application): application is CharacterHitPointOutcomeApplication =>
        'afterCurrentHitPoints' in application
    )
    .pop()
  return last
    ? {
        ...binding,
        currentHitPoints: last.afterCurrentHitPoints,
        temporaryHitPoints: last.afterTemporaryHitPoints
      }
    : binding
}

/**
 * Settles the whole action once every roll is answered: each entry takes the outcome its own roll
 * selected, with its own resistance, immunity and vulnerability. A point area (`rollsPerTarget`
 * false) rolls its damage once and freezes it across the creatures; a list of rays rolls each ray's
 * damage on its own, and a creature a further ray is aimed at meets the hit points its earlier rays
 * left it. A creature may carry a Legendary Resistance decision sealed against its own failed save.
 */
export async function settleEncounterAreaAction(
  input: AreaActionSource & {
    targets: readonly EncounterAreaTarget[]
    tests: readonly EncounterAreaTargetTest[]
    legendaryResistance?: ReadonlyMap<string, EncounterAreaLegendaryResistanceAudit>
    rollsPerTarget?: boolean
  }
) {
  requireDistinctEntries(input.targets)
  if (
    input.tests.length !== input.targets.length ||
    input.tests.some((test) => test.kind !== 'TESTED')
  )
    throw new Error('Every entry must answer its roll before the area settles.')
  if (
    input.tests.some(
      (test) =>
        test.kind === 'TESTED' &&
        test.legendaryResistance &&
        !input.legendaryResistance?.has(test.actorId)
    )
  )
    throw new Error('A Legendary Resistance choice is undecided; the area cannot settle.')
  const random = input.random ?? nextRollInt
  const sharedRolls = createFrozenRollTape(random)
  const bindings = new Map<string, EncounterAreaTarget['binding']>()
  const settled = []
  for (const target of input.targets) {
    const test = input.tests.find((entry) => entry.occurrenceId === target.occurrenceId)
    if (test?.kind !== 'TESTED') throw new Error('The area roll is unavailable.')
    const binding = bindings.get(target.actorId) ?? target.currentBinding ?? target.binding
    const result = await continueNativeActionAfterTest({
      ...input,
      occurrenceId: target.occurrenceId,
      binding,
      testBinding: target.binding,
      // The roller of a nested save would pause here: only the damage may be rolled.
      autoRoll: { SOURCE: true, TARGET: false },
      afterTest: async () => undefined,
      random: input.rollsPerTarget ? createFrozenRollTape(random)() : sharedRolls(),
      boundary: test.boundary,
      legendaryResistance: input.legendaryResistance?.get(target.actorId) ?? null
    })
    if (result.kind !== 'COMPLETE')
      throw new Error('An area outcome cannot ask for evidence beyond its damage.')
    bindings.set(target.actorId, bindingAfterHitPoints(binding, result.applications))
    settled.push({ actorId: target.actorId, occurrenceId: target.occurrenceId, complete: result })
  }
  return settled
}
