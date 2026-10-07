// @vitest-environment node
import { expect, it } from 'vitest'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { setupConcentration } from '../../tests/fixtures/concentration'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'

useLocalRoomWorker()

const droppedTables = [
  'encounterActorSnapshots',
  'encounterSceneBindings',
  'encounterActorTokenBindings',
  'encounterInitiativeRounds',
  'encounterInitiativeParticipants',
  'encounterInitiativeSides',
  'encounterRuleOccurrences',
  'encounterPendingSnapshotParts',
  'encounterReplayIndex',
  'encounterTurnMovements',
  'encounterDecisionSkips',
  'encounterActiveRuleEffects',
  'encounterMaintainedEffectStates',
  'encounterSpatialRuleEffects',
  'encounterRunCommands',
  'encounterRuleReceipts'
] as const

it('keeps only the finished view of a Run with a Character and a Creature (ADR 0035 Amendment 30)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { owner, run, t } = fixture
  await attachFixtureRoom(t, fixture.campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  expect(live.actors.map((actor) => actor.kind).sort()).toEqual(['CHARACTER', 'CREATURE'])
  // The fixture also holds a second Run, whose rows must stay untouched.
  const countRows = () =>
    t.run(async (ctx) => {
      const own = async (table: (typeof droppedTables)[number]) =>
        (await ctx.db.query(table).collect()).filter((row) => row.encounterId === run.id).length
      return {
        dropped: Object.fromEntries(
          await Promise.all(droppedTables.map(async (table) => [table, await own(table)] as const))
        ),
        runs: (await ctx.db.query('encounterRuns').collect()).length,
        actors: (await ctx.db.query('encounterRunActors').collect()).filter(
          (row) => row.encounterId === run.id
        ).length,
        sources: (await ctx.db.query('encounterSourceProjectionFacts').collect()).filter(
          (row) => row.encounterId === run.id
        ).length
      }
    })
  const before = await countRows()
  expect(before.dropped.encounterActorSnapshots).toBeGreaterThan(0)
  expect(before.dropped.encounterInitiativeRounds).toBe(1)
  expect(before.sources).toBeGreaterThan(0)

  const completed = await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  expect(completed.projection.status).toBe('COMPLETED')

  expect(await countRows()).toEqual({
    dropped: Object.fromEntries(droppedTables.map((table) => [table, 0])),
    runs: before.runs,
    actors: before.actors,
    sources: before.sources
  })
  const finished = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  expect(finished).toEqual(completed.projection)
  const summary = (projection: typeof finished) =>
    projection.actors
      .map((actor) => ({
        id: actor.id,
        kind: actor.kind,
        label: actor.label,
        hitPoints: 'currentHitPoints' in actor ? [actor.currentHitPoints, actor.maxHitPoints] : null
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  expect(summary(finished)).toEqual(summary(live))
  expect(summary(finished).every((actor) => actor.label.length > 0 && actor.hitPoints)).toBe(true)
  await expect(
    executeInRoom(owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: finished.version
      }
    })
  ).rejects.toThrow('Completed Encounters are read-only.')
}, 60_000)

it('reads a finished Run after its Character departs the Campaign (D74, D81)', async () => {
  const fixture = await setupConcentration('PROMPT')
  const { owner, player, run, t } = fixture
  await attachFixtureRoom(t, fixture.campaign.id)
  const live = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  const completed = await executeInRoom(owner.caller, {
    command: {
      type: 'COMPLETE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: live.version
    }
  })
  expect(completed.projection.status).toBe('COMPLETED')
  await checkpointLiveRoom(fixture.campaign.id)
  const frozenActors = () =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
          .collect()
      ).flatMap((row) => {
        const actor = readStoredRunActor(row)
        return actor.kind === 'CHARACTER'
          ? [{ id: actor.id, frozen: Boolean(actor.frozenState) }]
          : []
      })
    )
  // Completion froze every Character actor, so a later departure has nothing to read.
  expect(await frozenActors()).toEqual([{ id: expect.any(String), frozen: true }])

  await player.caller.mutation(api.campaigns.assignments.unassign, {
    campaignId: fixture.campaign.id
  })
  const finished = await owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  expect(finished).toEqual(completed.projection)
}, 60_000)
