// @vitest-environment node
import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import {
  readCampaignRunState,
  readRunActors
} from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterSessionState } from '@artificer-toolkit/encounter-persistence/sessionReads'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { createActorCapRun } from '../../tests/fixtures/encounterActorCap'
import { srdWolf } from '../../tests/fixtures/srdCreatures'
import { useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { requireCampaignAuthority } from '../campaigns/authority'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import { readActiveRun } from '../encounters/projectionReads'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

/** PERF-1 targets (ADR 0035 Decision 9), in milliseconds. */
const COMMAND_P95_MS = 1_000
const CONVERGENCE_P95_MS = 250
/**
 * A projection pass computes one stat block per Creature. It may take a tenth of the tighter PERF-1
 * target (convergence), so computing armor class on every call cannot by itself break either target.
 */
const PASS_SHARE = 0.1
const CREATURES = MAX_ENCOUNTER_ACTORS - 1
const PASS_BUDGET_MS = PASS_SHARE * Math.min(COMMAND_P95_MS, CONVERGENCE_P95_MS)
const CALL_BUDGET_MS = PASS_BUDGET_MS / CREATURES
const PASSES = 20

/**
 * A Blueprint's snapshots share one payload limit, so the cap Run repeats a few Creatures: wolves
 * (natural armor alone) and Creatures whose computed armor class reads an equipment loadout.
 */
const ARMORED_AND_PLAIN_CREATURES = [
  srdWolf,
  ...srdCreatureRecords
    .filter((creature) => (creature.equipmentLoadout ?? []).length > 0)
    .slice(0, 1)
]

const percentile = (sorted: readonly number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!

// PERF-4.4: snapshotStatBlock recomputes armor class on every call. The Run is 1 Character and 99
// Creatures; the Convex read path and the room's projection both call it per Creature.
it('computes the stat blocks of a Run at the actor cap within the PERF-1 targets', async () => {
  const { base, prepared } = await createActorCapRun(ARMORED_AND_PLAIN_CREATURES)
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

    // Warm the module graph and registries, as a live room is warm; the first call is a cold start.
    for (const creature of creatures) snapshotStatBlock(creature)
    const calls: number[] = []
    const passes: number[] = []
    for (let pass = 0; pass < PASSES; pass++) {
      const passStart = performance.now()
      for (const creature of creatures) {
        const start = performance.now()
        expect(snapshotStatBlock(creature)?.armorClass).not.toBeNull()
        calls.push(performance.now() - start)
      }
      passes.push(performance.now() - passStart)
    }

    const sessionReads: number[] = []
    for (let read = 0; read < PASSES; read++) {
      const start = performance.now()
      const session = await readEncounterSessionState(encounterReadTransaction(ctx), {
        row,
        campaign,
        membership
      })
      sessionReads.push(performance.now() - start)
      expect(session.encounter?.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
    }
    return {
      calls: calls.sort((a, b) => a - b),
      passes: passes.sort((a, b) => a - b),
      sessionReads: sessionReads.sort((a, b) => a - b)
    }
  })

  const summary = {
    creatures: CREATURES,
    callMs: {
      p50: percentile(measured.calls, 0.5),
      p95: percentile(measured.calls, 0.95),
      max: measured.calls.at(-1)
    },
    passMs: {
      p50: percentile(measured.passes, 0.5),
      p95: percentile(measured.passes, 0.95),
      max: measured.passes.at(-1)
    },
    sessionReadMs: {
      p50: percentile(measured.sessionReads, 0.5),
      p95: percentile(measured.sessionReads, 0.95),
      max: measured.sessionReads.at(-1)
    },
    budget: { callMs: CALL_BUDGET_MS, passMs: PASS_BUDGET_MS }
  }
  console.info('PERF-4.T1 stat block cost at the cap', JSON.stringify(summary))
  expect(percentile(measured.calls, 0.95)).toBeLessThanOrEqual(CALL_BUDGET_MS)
  expect(percentile(measured.passes, 0.95)).toBeLessThanOrEqual(PASS_BUDGET_MS)
  // The Convex session read as a whole stays inside the command budget.
  expect(percentile(measured.sessionReads, 0.95)).toBeLessThanOrEqual(COMMAND_P95_MS)
}, 600_000)
