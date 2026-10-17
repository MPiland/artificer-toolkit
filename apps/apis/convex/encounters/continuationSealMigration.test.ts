import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { disarmInRoom, disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { checkpointLiveRoom, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const cancelSealedDecisions = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'encounters/continuationSealMigration:run'
)

it('cancels a decision paused with a sealed continuation and leaves current ones paused', async ({
  onTestFinished
}) => {
  const base = await nativeDisarmFixture('PROMPT')
  const started = await disarmInRoom(base.owner, base.command)
  const pending = started.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE') throw new Error('Expected Disarm evidence.')
  await checkpointLiveRoom(base.campaign.id)
  migrations.register(base.t)
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const migrate = async () => {
    await base.t.mutation(cancelSealedDecisions, {})
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  }

  // A current kernel-evidence snapshot carries no seal and stays paused.
  const current = await disarmRecords(base)
  expect(current.occurrences).toEqual([
    expect.objectContaining({ id: pending.occurrenceId, state: 'PENDING' })
  ])
  expect(current.pendingSnapshots[0]).toMatchObject({ snapshotKind: 'KERNEL_EVIDENCE' })
  await migrate()
  expect(await disarmRecords(base)).toEqual(current)

  // A snapshot stored before Q23 has a seal inside its checksum.
  await base.t.run(async (ctx) => {
    const occurrence = current.occurrences[0]!
    const [part, ...deltas] = await ctx.db
      .query('encounterPendingSnapshotParts')
      .withIndex('by_occurrenceId_sequence', (q) => q.eq('occurrenceId', occurrence.id))
      .collect()
    expect(deltas).toEqual([])
    const { base: snapshot } = JSON.parse(part!.partJson) as { base: Record<string, unknown> }
    const sealed = { ...snapshot, seal: 'a'.repeat(64) }
    await ctx.db.patch(part!._id, { partJson: JSON.stringify({ base: sealed }) })
    await ctx.db.patch(occurrence._id, { pendingSnapshotChecksum: checksumCanonicalJson(sealed) })
  })
  await migrate()
  // A second pass proves the migration is idempotent on cancelled rows.
  await migrate()

  const cancelled = await disarmRecords(base)
  expect(cancelled.occurrences).toEqual([
    expect.objectContaining({
      id: pending.occurrenceId,
      state: 'VOIDED',
      version: current.occurrences[0]!.version + 1,
      pendingSnapshotChecksum: null,
      completedAt: expect.any(String)
    })
  ])
  expect(cancelled.pendingSnapshots).toEqual([null])
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('encounterPendingSnapshotParts')
        .withIndex('by_occurrenceId_sequence', (q) => q.eq('occurrenceId', pending.occurrenceId))
        .collect()
    )
  ).toEqual([])
  expect(cancelled.actors).toEqual(current.actors)
}, 60_000)
