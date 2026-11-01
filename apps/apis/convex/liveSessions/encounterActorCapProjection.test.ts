// @vitest-environment node
import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import {
  readCampaignRunState,
  readRunActors
} from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterSessionState } from '@artificer-toolkit/encounter-persistence/sessionReads'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import {
  snapshotCreatureSenses,
  snapshotStatBlock
} from '@artificer-toolkit/rules-runtime/encounterProjection'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { createActorCapRun } from '../../tests/fixtures/encounterActorCap'
import { useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { requireCampaignAuthority } from '../campaigns/authority'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import { readActiveRun } from '../encounters/projectionReads'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

/** PERF-1 targets (ADR 0035 Decision 9), in milliseconds. */
const COMMAND_P95_MS = 1_000
const CONVERGENCE_P95_MS = 250
/** A pass over every Creature may take a tenth of the target of the path that runs it. */
const PASS_SHARE = 0.1
const CREATURES = MAX_ENCOUNTER_ACTORS - 1
const PASSES = 20
/** Scene vision runs on token moves and scene commits, so it is on the convergence path. */
const VISION_PASS_BUDGET_MS = PASS_SHARE * CONVERGENCE_P95_MS
/** Command results project every Creature's stat block inside the command. */
const COMMAND_PASS_BUDGET_MS = PASS_SHARE * COMMAND_P95_MS

/**
 * The three smallest SRD Creatures that wear equipment: a Blueprint stores one full snapshot per
 * enemy under one payload limit (about 10.6 KB each at 99 enemies), and these keep the all-armored
 * Run at the cap inside it (10.2 KB on average).
 */
const ARMORED_CREATURES = ['Hill Giant', 'Grimlock', 'Ogre Zombie'].map((label) => {
  const creature = srdCreatureRecords.find((candidate) => candidate.label === label)
  if (!creature?.equipmentLoadout?.length) throw new Error(`${label} no longer wears equipment.`)
  return creature
})

const percentile = (sorted: readonly number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!

const timed = async <T>(run: () => Promise<T> | T) => {
  const start = performance.now()
  const result = await run()
  return { ms: performance.now() - start, result }
}

const summarize = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b)
  return { p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted.at(-1)! }
}

// PERF-4.4: computing armor class on every stat block must keep a Run at the cap inside the PERF-1
// targets. The Run is 1 Character and 99 armored Creatures.
it('projects the Creatures of a Run at the actor cap within the PERF-1 targets', async () => {
  const { base, prepared } = await createActorCapRun(ARMORED_CREATURES)
  await base.t.run((ctx) => activateFixtureRun(ctx, prepared.id))

  const measured = await base.owner.caller.run(async (ctx) => {
    const { campaign, membership } = await requireCampaignAuthority(
      ctx,
      base.campaign.id,
      base.owner.userId
    )
    const row = await readActiveRun(ctx, campaign.id)
    const state = readCampaignRunState(row!, campaign)
    const actors = await readRunActors({ db: createConvexEncounterStore(ctx) }, state)
    const creatures = actors.filter((actor) => actor.kind === 'CREATURE')
    expect(creatures).toHaveLength(CREATURES)
    for (const creature of creatures) {
      expect(snapshotStatBlock(creature)?.armorClass).not.toBeNull()
      expect(snapshotCreatureSenses(creature)).toEqual(snapshotStatBlock(creature)?.senses)
    }

    // The module graph and registries are warm, as in a live room; the first pass was above.
    const passes = (pass: (creature: (typeof creatures)[number]) => unknown) =>
      Array.from({ length: PASSES }, () => {
        const start = performance.now()
        for (const creature of creatures) pass(creature)
        return performance.now() - start
      })
    const statBlocks = passes(snapshotStatBlock)
    const senses = passes(snapshotCreatureSenses)
    const sessionReads: number[] = []
    for (let read = 0; read < PASSES; read++) {
      const { ms, result } = await timed(() =>
        readEncounterSessionState(encounterReadTransaction(ctx), { row, campaign, membership })
      )
      sessionReads.push(ms)
      expect(result.encounter?.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
    }
    return { statBlocks, senses, sessionReads }
  })

  console.info(
    'PERF-4.T1 projection cost at the cap',
    JSON.stringify({
      creatures: CREATURES,
      statBlockPassMs: summarize(measured.statBlocks),
      sensesPassMs: summarize(measured.senses),
      sessionReadMs: summarize(measured.sessionReads),
      budgetMs: { visionPass: VISION_PASS_BUDGET_MS, commandPass: COMMAND_PASS_BUDGET_MS }
    })
  )
  expect(summarize(measured.senses).p95).toBeLessThanOrEqual(VISION_PASS_BUDGET_MS)
  expect(summarize(measured.statBlocks).p95).toBeLessThanOrEqual(COMMAND_PASS_BUDGET_MS)
  expect(summarize(measured.sessionReads).p95).toBeLessThanOrEqual(COMMAND_P95_MS)
}, 600_000)
