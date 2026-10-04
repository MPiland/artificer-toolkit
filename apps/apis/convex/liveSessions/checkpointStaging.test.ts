import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { LiveSessionCheckpointFenceInput } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import type { LiveSessionCheckpointResponse } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionCheckpointRecords } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import type {
  LiveSessionCheckpointCommitInput,
  LiveSessionCheckpointPartInput,
  LiveSessionCheckpointStageInput,
  LiveSessionCheckpointStageResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpointStaging'
import type { LiveSessionJoinOptionsDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type {
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
} from '@artificer-toolkit/schema/api/liveSessionState'
import { decodeCheckpointRecord } from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { diffJson } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { encodeBase64 } from '@artificer-toolkit/shared/base64'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readReceiptLedger } from '../lib/receiptLedgers'

afterEach(() => vi.useRealTimers())

const claim = makeFunctionReference<'mutation', LiveSessionJoinOptionsDto, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const commitActivation = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:commitActivation')
const begin = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointStageInput,
  LiveSessionCheckpointStageResponse
>('liveSessions/checkpointStaging:begin')
const part = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointPartInput,
  LiveSessionCheckpointStageResponse
>('liveSessions/checkpointStaging:part')
const commit = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointCommitInput,
  LiveSessionCheckpointResponse
>('liveSessions/checkpointStaging:commit')
const cleanup = makeFunctionReference<'mutation', { checkpointId: string }, null>(
  'liveSessions/checkpointStaging:cleanup'
)

async function checkpointFixture(label = 'Checkpoint reminder') {
  const base = await setupCharacterRun()
  const claimed = await base.owner.caller.mutation(claim, {
    campaignId: base.campaign.id
  })
  const active = await base.t.mutation(commitActivation, {
    campaignId: base.campaign.id,
    epoch: claimed.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
  })
  const run = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const { _id, _creationTime, ...stored } = row
    const state = readRunState(row)
    const nextState = { ...state, version: row.version + 1 }
    const nextStored = {
      ...stored,
      version: nextState.version,
      stateJson: canonicalizeJson(nextState),
      stateChecksum: checksumCanonicalJson(nextState)
    }
    return { row, stored, nextStored }
  })
  const before = decodeCheckpointRecord('encounterRuns', run.stored)
  const after = decodeCheckpointRecord('encounterRuns', run.nextStored)
  const replay = { roll: null, occurrence: null }
  const receipt = decodeCheckpointRecord('encounterRunCommands', {
    id: crypto.randomUUID(),
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    commandFingerprint: 'c'.repeat(64),
    actorUserId: base.owner.userId,
    createdAt: base.campaign.createdAt,
    visibility: 'TABLE',
    commandType: 'UPSERT_REMINDER',
    version: run.nextStored.version,
    commandJson: canonicalizeJson({ type: 'UPSERT_REMINDER', label }),
    replayReceiptJson: canonicalizeJson(replay),
    replayReceiptChecksum: checksumCanonicalJson(replay)
  })
  const records: LiveSessionCheckpointRecords = {
    scenes: [],
    changes: [
      {
        table: 'encounterRuns',
        key: [run.row.id],
        previousChecksum: checksumCanonicalJson(before),
        nextChecksum: checksumCanonicalJson(after),
        delta: diffJson(before, after)
      }
    ],
    history: [
      {
        table: 'encounterRunCommands',
        key: [base.campaign.id, String(receipt.commandId)],
        value: receipt,
        checksum: checksumCanonicalJson(receipt)
      }
    ]
  }
  const frame: LiveSessionCheckpointFenceInput = {
    campaignId: base.campaign.id,
    epoch: active.epoch,
    checkpointId: crypto.randomUUID(),
    fromSequence: active.persistedSequence,
    fromChecksum: active.persistedStateChecksum,
    sequence: active.persistedSequence + 3,
    checksum: 'b'.repeat(64),
    payloadChecksum: checksumCanonicalJson(records)
  }
  return { ...base, run, records, frame }
}

type Fixture = Awaited<ReturnType<typeof checkpointFixture>>

function uploadPlan(frame: LiveSessionCheckpointFenceInput, bytes: Uint8Array) {
  const parts: LiveSessionCheckpointPartInput[] = Array.from(
    { length: Math.ceil(bytes.byteLength / JSON_PAYLOAD_CHUNK_MAX_BYTES) },
    (_, index) => ({
      campaignId: frame.campaignId,
      epoch: frame.epoch,
      checkpointId: frame.checkpointId,
      index,
      data: encodeBase64(
        bytes.subarray(
          index * JSON_PAYLOAD_CHUNK_MAX_BYTES,
          (index + 1) * JSON_PAYLOAD_CHUNK_MAX_BYTES
        )
      )
    })
  )
  return {
    stage: { ...frame, byteLength: bytes.byteLength, partCount: parts.length },
    parts,
    commit: { ...frame, knownAuthorization: null, reason: 'DEADLINE' as const }
  }
}

function recordsPlan(base: Fixture, records = base.records) {
  return uploadPlan(
    {
      ...base.frame,
      checkpointId: crypto.randomUUID(),
      payloadChecksum: checksumCanonicalJson(records)
    },
    new TextEncoder().encode(canonicalizeJson(records))
  )
}

async function upload(base: Fixture, plan: ReturnType<typeof uploadPlan>) {
  await base.t.mutation(begin, plan.stage)
  for (const input of plan.parts) await base.t.mutation(part, input)
}

function snapshot(base: Fixture) {
  return base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.row.id))
      .unique(),
    play: await ctx.db
      .query('characterPlayStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
      .unique(),
    authorities: await ctx.db.query('campaignLiveAuthorities').take(10),
    ledgers: await ctx.db.query('receiptLedgers').take(100),
    ledgerParts: await ctx.db.query('receiptLedgerParts').take(100),
    headers: await ctx.db.query('encounterRunCommands').take(100),
    uploads: await ctx.db.query('liveSessionCheckpointUploads').take(100),
    parts: await ctx.db.query('liveSessionCheckpointUploadParts').take(100),
    revisions: await ctx.db.query('sceneVisionRevisions').take(100),
    scheduled: await ctx.db.system.query('_scheduled_functions').take(100)
  }))
}

it('publishes a multi-part UTF-8 checkpoint and replays begin and commit after deleting uploaded bytes', async () => {
  const base = await checkpointFixture('🛠'.repeat(70_000))
  const plan = recordsPlan(base)
  expect(plan.stage.byteLength).toBeGreaterThan(JSON_PAYLOAD_CHUNK_MAX_BYTES)
  expect(plan.parts).toHaveLength(2)
  await upload(base, plan)
  const committed = await base.t.mutation(commit, plan.commit)
  expect(committed.status).toBe('COMMITTED')
  expect(committed.authority).toMatchObject({
    persistedSequence: plan.commit.sequence,
    persistedStateChecksum: plan.commit.checksum,
    lastCheckpoint: {
      checkpointId: plan.commit.checkpointId,
      payloadChecksum: plan.commit.payloadChecksum
    }
  })
  const published = await snapshot(base)
  expect(published.run).toEqual({ ...base.run.row, ...base.run.nextStored })
  expect(published.uploads).toEqual([])
  expect(published.parts).toEqual([])
  const ledger = published.ledgers.find((row) => row.checkpointId === plan.commit.checkpointId)
  if (!ledger) throw new Error('Missing checkpoint history ledger.')
  expect(
    published.headers.filter((row) => row.commandId === base.records.history[0]!.value.commandId)
  ).toHaveLength(1)
  await base.t.run(async (ctx) => {
    expect((await readReceiptLedger(ctx, ledger.id)).entries).toEqual(base.records.history)
  })

  vi.useFakeTimers()
  vi.setSystemTime(Date.now() + 1_000)
  // Staging metadata is immutable until commit; completed retries use the retained frame and digest.
  await expect(base.t.mutation(begin, plan.stage)).resolves.toEqual({
    status: 'REPLAYED'
  })
  await expect(base.t.mutation(commit, plan.commit)).resolves.toMatchObject({
    status: 'REPLAYED',
    authority: committed.authority
  })
  expect(await snapshot(base)).toEqual(published)
  await expect(
    base.t.mutation(begin, { ...plan.stage, payloadChecksum: 'f'.repeat(64) })
  ).rejects.toThrow('retry differs from the acknowledged payload')
  await expect(
    base.t.mutation(commit, { ...plan.commit, checksum: 'f'.repeat(64) })
  ).rejects.toThrow('retry differs from the acknowledged payload')
  expect(await snapshot(base)).toEqual(published)
})

it('makes begin and indexed part retries idempotent and rejects altered metadata, bytes and scope', async () => {
  const base = await checkpointFixture()
  const plan = recordsPlan(base)
  await upload(base, plan)
  const before = await snapshot(base)
  await expect(base.t.mutation(begin, plan.stage)).resolves.toEqual({
    status: 'STAGED'
  })
  await expect(base.t.mutation(part, plan.parts[0]!)).resolves.toEqual({
    status: 'STAGED'
  })
  expect(await snapshot(base)).toEqual(before)
  expect(before.uploads).toHaveLength(1)
  expect(before.parts).toHaveLength(1)

  for (const changed of [
    { byteLength: plan.stage.byteLength + 1 },
    { checksum: 'f'.repeat(64) },
    { payloadChecksum: 'f'.repeat(64) }
  ]) {
    await expect(base.t.mutation(begin, { ...plan.stage, ...changed })).rejects.toThrow(
      'upload identity was already used'
    )
    expect(await snapshot(base)).toEqual(before)
  }
  const partInput = plan.parts[0]!
  const different = new TextEncoder().encode(canonicalizeJson(base.records))
  different[0] = different[0]! ^ 1
  for (const changed of [
    { campaignId: crypto.randomUUID() },
    { epoch: crypto.randomUUID() },
    { index: plan.parts.length },
    { data: encodeBase64(different) },
    { data: encodeBase64(different.subarray(1)) },
    { data: `${partInput.data.slice(0, -1)}!` }
  ]) {
    await expect(base.t.mutation(part, { ...partInput, ...changed })).rejects.toThrow()
    expect(await snapshot(base)).toEqual(before)
  }
  for (const changed of [
    { epoch: crypto.randomUUID() },
    { campaignId: crypto.randomUUID() },
    { fromSequence: 1 },
    { fromChecksum: 'f'.repeat(64) }
  ]) {
    await expect(base.t.mutation(begin, { ...plan.stage, ...changed })).rejects.toThrow()
    await expect(base.t.mutation(commit, { ...plan.commit, ...changed })).rejects.toThrow()
    expect(await snapshot(base)).toEqual(before)
  }
  await expect(
    base.t.mutation(commit, { ...plan.commit, checksum: 'f'.repeat(64) })
  ).rejects.toThrow('upload fence does not match')
  expect(await snapshot(base)).toEqual(before)

  for (const changed of [{ byteLength: 4 * 1024 * 1024 + 1 }, { partCount: 2 }]) {
    await expect(base.t.mutation(begin, { ...plan.stage, ...changed })).rejects.toThrow()
    expect(await snapshot(base)).toEqual(before)
  }
  const canonical = uploadPlan(
    { ...base.frame, checkpointId: crypto.randomUUID() },
    new Uint8Array([0, 1, 2, 3])
  )
  await base.t.mutation(begin, canonical.stage)
  const beforeNoncanonical = await snapshot(base)
  await expect(base.t.mutation(part, { ...canonical.parts[0]!, data: 'AAECAx==' })).rejects.toThrow(
    'part bytes are invalid'
  )
  expect(await snapshot(base)).toEqual(beforeNoncanonical)

  await base.t.mutation(commit, plan.commit)
  const acknowledged = await snapshot(base)
  await expect(base.t.mutation(part, canonical.parts[0]!)).rejects.toThrow(
    'retry differs from the acknowledged payload'
  )
  expect(await snapshot(base)).toEqual(acknowledged)
})

it('leaves staging, state, history and the fence unchanged for incomplete or invalid uploads', async () => {
  const base = await checkpointFixture()
  const incomplete = recordsPlan(base)
  await base.t.mutation(begin, incomplete.stage)
  const missing = await snapshot(base)
  await expect(base.t.mutation(commit, incomplete.commit)).rejects.toThrow('upload is incomplete')
  expect(await snapshot(base)).toEqual(missing)

  const bytes = new TextEncoder().encode(canonicalizeJson(base.records))
  const invalidUtf8 = bytes.slice()
  invalidUtf8[0] = 0xff
  const corrupted = new TextEncoder().encode(
    canonicalizeJson(base.records).replace('Checkpoint reminder', 'Checkpoint remindeq')
  )
  const staleRecords: LiveSessionCheckpointRecords = {
    ...base.records,
    changes: [{ ...base.records.changes[0]!, previousChecksum: 'f'.repeat(64) }]
  }
  const invalidPlans = [
    {
      plan: uploadPlan({ ...base.frame, checkpointId: crypto.randomUUID() }, invalidUtf8),
      error: 'UTF-8 is invalid'
    },
    {
      plan: uploadPlan(
        { ...base.frame, checkpointId: crypto.randomUUID() },
        new TextEncoder().encode('{')
      ),
      error: undefined
    },
    {
      plan: uploadPlan(
        { ...base.frame, checkpointId: crypto.randomUUID() },
        new TextEncoder().encode('{}')
      ),
      error: undefined
    },
    {
      plan: uploadPlan(
        {
          ...base.frame,
          checkpointId: crypto.randomUUID(),
          payloadChecksum: 'f'.repeat(64)
        },
        bytes
      ),
      error: 'payload checksum does not match'
    },
    {
      plan: uploadPlan({ ...base.frame, checkpointId: crypto.randomUUID() }, corrupted),
      error: 'payload checksum does not match'
    },
    {
      plan: recordsPlan(base, staleRecords),
      error: 'record changed before publication'
    }
  ]
  for (const { plan, error } of invalidPlans) {
    await upload(base, plan)
    const before = await snapshot(base)
    await expect(base.t.mutation(commit, plan.commit)).rejects.toThrow(error)
    expect(await snapshot(base)).toEqual(before)
  }
})

it('rolls back publication, history, fence and staging deletions when the enclosing mutation throws', async () => {
  const base = await checkpointFixture()
  const plan = recordsPlan(base)
  await upload(base, plan)
  const before = await snapshot(base)
  await expect(
    base.t.run(async (ctx) => {
      const published = await ctx.runMutation(commit, plan.commit)
      expect(published.status).toBe('COMMITTED')
      expect(
        await ctx.db
          .query('liveSessionCheckpointUploads')
          .withIndex('by_checkpointId', (q) => q.eq('checkpointId', plan.commit.checkpointId))
          .unique()
      ).toBeNull()
      expect(
        await ctx.db
          .query('liveSessionCheckpointUploadParts')
          .withIndex('by_checkpointId_index', (q) => q.eq('checkpointId', plan.commit.checkpointId))
          .take(10)
      ).toEqual([])
      expect(
        await ctx.db
          .query('encounterRunCommands')
          .withIndex('by_campaignId_commandId', (q) =>
            q
              .eq('campaignId', base.campaign.id)
              .eq('commandId', String(base.records.history[0]!.value.commandId))
          )
          .unique()
      ).not.toBeNull()
      throw new Error('Injected post-checkpoint rollback')
    })
  ).rejects.toThrow('Injected post-checkpoint rollback')
  expect(await snapshot(base)).toEqual(before)
  await expect(base.t.mutation(commit, plan.commit)).resolves.toMatchObject({
    status: 'COMMITTED'
  })
})

it('expires uploads, deletes at most four parts per pass and completes scheduled cleanup idempotently', async () => {
  const base = await checkpointFixture()
  vi.useFakeTimers()
  const plan = uploadPlan(base.frame, new Uint8Array(4 * JSON_PAYLOAD_CHUNK_MAX_BYTES + 3))
  await upload(base, plan)
  await base.t.run(async (ctx) => {
    for (const job of await ctx.db.system.query('_scheduled_functions').take(100)) {
      if (job.name !== 'liveSessions/checkpointStaging:cleanup' && job.state.kind === 'pending')
        await ctx.scheduler.cancel(job._id)
    }
  })
  const staged = await snapshot(base)
  expect(staged.parts).toHaveLength(5)
  const uploadRow = staged.uploads[0]
  if (!uploadRow) throw new Error('Missing staged upload.')
  vi.setSystemTime(uploadRow.expiresAt)
  await expect(base.t.mutation(begin, plan.stage)).rejects.toThrow('upload has expired')
  await expect(base.t.mutation(part, plan.parts[0]!)).rejects.toThrow('upload has expired')
  await expect(base.t.mutation(commit, plan.commit)).rejects.toThrow('upload has expired')
  expect(await snapshot(base)).toEqual(staged)

  await base.t.mutation(cleanup, { checkpointId: plan.stage.checkpointId })
  const partial = await snapshot(base)
  expect(partial.parts).toHaveLength(1)
  expect(partial.uploads).toEqual(staged.uploads)
  expect(partial.run).toEqual(staged.run)
  expect(partial.authorities).toEqual(staged.authorities)
  expect(partial.ledgers).toEqual(staged.ledgers)
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  const cleaned = await snapshot(base)
  expect(cleaned.uploads).toEqual([])
  expect(cleaned.parts).toEqual([])
  expect(cleaned.run).toEqual(staged.run)
  expect(cleaned.authorities).toEqual(staged.authorities)
  expect(cleaned.ledgers).toEqual(staged.ledgers)
  await base.t.mutation(cleanup, { checkpointId: plan.stage.checkpointId })
  expect(await snapshot(base)).toEqual(cleaned)
})
