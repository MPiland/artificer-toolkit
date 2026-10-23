import { makeFunctionReference } from 'convex/server'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { runActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionCheckpointRequest,
  LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import {
  liveSessionCheckpointHistoryEntrySchema,
  liveSessionCheckpointRecordsSchema,
  receiptLedgerEntryKeyFields,
  type ReceiptLedgerEntry,
  type LiveSessionCheckpointRecordChange,
  type LiveSessionCheckpointRecords,
  type LiveSessionCheckpointRetainedRoll,
  type LiveSessionCheckpointTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import type { LiveSessionJoinOptionsDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { liveSessionControlInputSchema } from '@artificer-toolkit/schema/api/liveSessions'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import type {
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
} from '@artificer-toolkit/schema/api/liveSessionState'
import {
  canonicalJsonRecordSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { decodeCheckpointRecord } from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { diffJson } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { createCampaign } from '../../tests/fixtures/encounterScene'
import { checkpointLiveRoom, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { disarmInRoom, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readReceiptHeaders, readReceiptLedger } from '../lib/receiptLedgers'
import { presentCampaignLiveAuthority } from './authority'
import { requireSystem } from '../content/systemDocuments'
import { retainUserRolls } from '../rollDocuments'
import {
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema,
  campaignStoredEntryPayloadSchema,
  createCampaignEntryHeader
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'

// Registered before the timer hook below: hooks after each test run in reverse, so the room closes
// on real timers.
useLocalRoomWorker()
afterEach(() => vi.useRealTimers())

const claim = makeFunctionReference<'mutation', LiveSessionJoinOptionsDto, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const commitActivation = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:commitActivation')
const publish = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointRequest,
  LiveSessionCheckpointResponse
>('liveSessions/checkpoint:publish')

type Fixture = Pick<
  Awaited<ReturnType<typeof setupCharacterRun>>,
  't' | 'owner' | 'player' | 'campaign' | 'run' | 'character'
>

async function activate(base: Fixture, campaignId = base.campaign.id) {
  const claimed = await base.owner.caller.mutation(claim, { campaignId })
  return base.t.mutation(commitActivation, {
    campaignId,
    epoch: claimed.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
  })
}

function recordChange(
  table: LiveSessionCheckpointTable,
  key: (string | number)[],
  before: Record<string, JsonValue> | null,
  after: Record<string, JsonValue> | null
): LiveSessionCheckpointRecordChange {
  return {
    table,
    key,
    previousChecksum: before ? checksumCanonicalJson(before) : null,
    nextChecksum: after ? checksumCanonicalJson(after) : null,
    delta: after ? diffJson(before, after) : null
  }
}

function historyEntry(
  table: 'characterCommandReceipts' | 'encounterRunCommands',
  fields: Record<string, unknown>
): ReceiptLedgerEntry {
  const value = decodeCheckpointRecord(table, fields)
  return {
    table,
    key: receiptLedgerEntryKeyFields[table].map((field) => {
      const identity = value[field]
      if (typeof identity !== 'string' && typeof identity !== 'number')
        throw new Error('Missing fixture history identity.')
      return identity
    }),
    value,
    checksum: checksumCanonicalJson(value)
  }
}

type FixtureRecords = Omit<LiveSessionCheckpointRecords, 'scenes'> &
  Partial<Pick<LiveSessionCheckpointRecords, 'scenes'>>

function frame(
  authority: LiveSessionAuthorityDto,
  records: FixtureRecords
): LiveSessionCheckpointRequest {
  const payload = { ...records, scenes: records.scenes ?? [] }
  return {
    campaignId: authority.campaignId,
    epoch: authority.epoch,
    checkpointId: crypto.randomUUID(),
    fromSequence: authority.persistedSequence,
    fromChecksum: authority.persistedStateChecksum,
    sequence: authority.persistedSequence + 3,
    checksum: 'b'.repeat(64),
    payloadChecksum: checksumCanonicalJson(payload),
    knownAuthorization: null,
    reason: 'BACKLOG',
    records: payload
  }
}

async function runChange(base: Fixture) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const { _id, _creationTime, ...stored } = row
    const state = readRunState(row)
    expect(row.stateChecksum).toBe(checksumCanonicalJson(state))
    const nextState = { ...state, version: row.version + 1 }
    const nextStored = {
      ...stored,
      version: nextState.version,
      stateJson: canonicalizeJson(nextState),
      stateChecksum: checksumCanonicalJson(nextState)
    }
    const before = decodeCheckpointRecord('encounterRuns', stored)
    return {
      row,
      before,
      nextStored,
      change: recordChange(
        'encounterRuns',
        [row.id],
        before,
        decodeCheckpointRecord('encounterRuns', nextStored)
      )
    }
  })
}

async function playChange(base: Fixture) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('characterPlayStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
      .unique()
    if (!row) throw new Error('Missing fixture Character play state.')
    const { _id, _creationTime, ...stored } = row
    expect(row.checksum).toBe(checksumCanonicalJson(row.state))
    const nextState = {
      ...row.state,
      hitpoints: {
        ...row.state.hitpoints,
        current: row.state.hitpoints.current - 1
      },
      partyVisibility: {
        ...row.state.partyVisibility,
        sheet: !row.state.partyVisibility.sheet
      }
    }
    const before = decodeCheckpointRecord('characterPlayStates', stored)
    const next = canonicalJsonRecordSchema.parse({
      ...before,
      state: nextState,
      checksum: checksumCanonicalJson(nextState),
      streamVersion: row.streamVersion + 1
    })
    return {
      row,
      before,
      next,
      nextState,
      change: recordChange('characterPlayStates', [row.characterId], before, next)
    }
  })
}

/** An Encounter command receipt: Encounter history stays in the room, so a checkpoint must refuse it. */
function encounterHistory(base: Fixture, version: number) {
  const replay = { roll: null, occurrence: null }
  return historyEntry('encounterRunCommands', {
    id: crypto.randomUUID(),
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    commandFingerprint: 'c'.repeat(64),
    actorUserId: base.owner.userId,
    createdAt: base.campaign.createdAt,
    visibility: 'TABLE',
    commandType: 'UPSERT_REMINDER',
    version,
    commandJson: canonicalizeJson({ type: 'UPSERT_REMINDER', label: 'Checkpoint reminder' }),
    replayReceiptJson: canonicalizeJson(replay),
    replayReceiptChecksum: checksumCanonicalJson(replay)
  })
}

function characterHistory(base: Fixture) {
  const history = { label: 'Checkpoint play update' }
  return liveSessionCheckpointHistoryEntrySchema.parse(
    historyEntry('characterCommandReceipts', {
      id: crypto.randomUUID(),
      characterId: base.character.id,
      commandId: crypto.randomUUID(),
      actorId: base.player.userId,
      commandFingerprint: 'e'.repeat(64),
      occurredAt: base.campaign.createdAt,
      historyJson: canonicalizeJson(history),
      historyChecksum: checksumCanonicalJson(history)
    })
  )
}

async function snapshot(base: Fixture) {
  return base.t.run(async (ctx) => {
    const scheduled = await ctx.db.system.query('_scheduled_functions').collect()
    return {
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique(),
      play: await ctx.db
        .query('characterPlayStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique(),
      authorities: await ctx.db.query('campaignLiveAuthorities').take(10),
      ledgers: await ctx.db.query('receiptLedgers').take(100),
      parts: await ctx.db.query('receiptLedgerParts').take(100),
      runHeaders: await ctx.db.query('encounterRunCommands').take(100),
      ruleHeaders: await ctx.db.query('encounterRuleReceipts').take(100),
      characterHeaders: await ctx.db.query('characterCommandReceipts').take(100),
      occurrences: await ctx.db.query('encounterRuleOccurrences').take(100),
      pendingParts: await ctx.db.query('encounterPendingSnapshotParts').take(100),
      revisions: await ctx.db.query('sceneVisionRevisions').take(100),
      scheduled,
      invalidations: scheduled.filter(
        (job) =>
          job.name === 'liveSessions/control:send' &&
          liveSessionControlInputSchema.parse(job.args[0]).operation.type === 'INVALIDATE_INPUTS'
      )
    }
  })
}

it('publishes Run and Character play deltas with Character history, then replays without state or ledger writes', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const run = await runChange(base)
  const play = await playChange(base)
  const privateHistory = characterHistory(base)
  const input = frame(authority, {
    changes: [run.change, play.change],
    history: [privateHistory]
  })
  const before = await snapshot(base)
  const beforeCharacterRevision = before.revisions.find(
    (row) => row.scope === 'CHARACTER' && row.id === base.character.id
  )
  if (!beforeCharacterRevision) throw new Error('Missing fixture Character revision.')
  const committed = await base.t.mutation(publish, input)
  expect(committed.status).toBe('COMMITTED')
  // The mutation reports its own transaction cost to the room's meter (D85).
  expect(committed.io.bytesRead).toBeGreaterThan(0)
  expect(committed.io.bytesWritten).toBeGreaterThan(0)
  expect(committed.io.documentsRead).toBeGreaterThan(0)
  expect(committed.io.documentsWritten).toBeGreaterThan(0)
  expect(committed.authority).toMatchObject({
    persistedSequence: 3,
    persistedStateChecksum: input.checksum,
    lastCheckpoint: {
      checkpointId: input.checkpointId,
      payloadChecksum: input.payloadChecksum
    }
  })
  expect(committed).not.toHaveProperty('authorization')
  const after = await snapshot(base)
  const afterCharacterRevision = after.revisions.find(
    (row) => row.scope === 'CHARACTER' && row.id === base.character.id
  )
  if (!afterCharacterRevision) throw new Error('Missing published Character revision.')
  expect(afterCharacterRevision.revision).not.toBe(beforeCharacterRevision.revision)
  expect(after.invalidations).toEqual(before.invalidations)
  expect(after.run).toEqual({ ...run.row, ...run.nextStored })
  expect(after.play).toEqual({ ...play.row, ...play.next })
  const checkpointLedgers = after.ledgers.filter(
    (ledger) => ledger.checkpointId === input.checkpointId
  )
  expect(checkpointLedgers.map(({ scope, scopeId }) => [scope, scopeId])).toEqual([
    ['CHARACTER', base.character.id]
  ])
  await base.t.run(async (ctx) => {
    for (const ledger of checkpointLedgers) {
      const decoded = await readReceiptLedger(ctx, ledger.id)
      expect(decoded.metadata.epoch).toBe(input.epoch)
      expect(decoded.entries).toEqual([privateHistory])
    }
    const characterHeader = after.characterHeaders.find(
      (header) => header.commandId === privateHistory.value.commandId
    )
    if (!characterHeader) throw new Error('Missing checkpoint header.')
    const [logicalCharacter] = await readReceiptHeaders(ctx, 'characterCommandReceipts', [
      characterHeader
    ])
    if (!logicalCharacter) throw new Error('Missing logical receipt.')
    const {
      _id: _characterId,
      _creationTime: _characterTime,
      ...characterFields
    } = logicalCharacter
    expect(decodeCheckpointRecord('characterCommandReceipts', characterFields)).toEqual(
      privateHistory.value
    )
  })

  const beforeReplay = await snapshot(base)
  vi.useFakeTimers()
  vi.setSystemTime(Date.now() + 1_000)
  const replayed = await base.t.mutation(publish, input)
  expect(replayed.status).toBe('REPLAYED')
  expect(replayed.authority).toEqual(committed.authority)
  expect(replayed.adopted).toEqual({ characters: [] })
  expect(await snapshot(base)).toEqual(beforeReplay)
})

/** A Creature or Custom actor's hit point change: the smallest flush a combat command produces. */
async function enemyHitPointChange(base: Fixture) {
  const enemy = base.run.actors.find((actor) => actor.kind !== 'CHARACTER')
  if (!enemy) throw new Error('Missing fixture enemy actor.')
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', enemy.id))
      .unique()
    if (!row) throw new Error('Missing fixture enemy actor row.')
    const { _id, _creationTime, ...stored } = row
    const state = readStoredRunActor(row)
    if (state.kind === 'CHARACTER') throw new Error('Fixture enemy actor is a Character.')
    const nextState = {
      ...state,
      currentHitPoints: state.currentHitPoints - 1
    }
    const before = decodeCheckpointRecord('encounterRunActors', stored)
    const next = decodeCheckpointRecord('encounterRunActors', {
      ...stored,
      stateJson: canonicalizeJson(nextState),
      stateChecksum: checksumCanonicalJson(runActorPlayState(nextState))
    })
    return recordChange('encounterRunActors', [row.encounterId, row.id], before, next)
  })
}

/** The Character actor, optionally with its Character frozen as the room does on departure (D74). */
async function characterActorChange(base: Fixture) {
  const actor = base.run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor) throw new Error('Missing fixture Character actor.')
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actor.id))
      .unique()
    if (!row) throw new Error('Missing fixture Character actor row.')
    const { _id, _creationTime, ...stored } = row
    const state = readStoredRunActor(row)
    if (state.kind !== 'CHARACTER') throw new Error('Fixture actor is not a Character.')
    const before = decodeCheckpointRecord('encounterRunActors', stored)
    const key = [row.encounterId, row.id]
    const nextState = {
      ...state,
      frozenState: {
        currentHitPoints: 1,
        maxHitPoints: 1,
        tempHitPoints: 0,
        conditions: [],
        deathSaves: { successes: 0, failures: 0, stable: false }
      }
    }
    const frozen = decodeCheckpointRecord('encounterRunActors', {
      ...stored,
      stateJson: canonicalizeJson(nextState),
      stateChecksum: checksumCanonicalJson(runActorPlayState(nextState))
    })
    return {
      freeze: recordChange('encounterRunActors', key, before, frozen),
      remove: recordChange('encounterRunActors', key, before, null)
    }
  })
}

async function runStatusChange(
  base: Fixture,
  status: 'ACTIVE' | 'COMPLETED',
  removedActorId?: string
) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const { _id, _creationTime, ...stored } = row
    const state = readRunState(row)
    const nextState = encounterRunStateSchema.parse({
      ...state,
      status,
      version: state.version + 1,
      actorIds: state.actorIds.filter((id) => id !== removedActorId),
      currentActorId: status === 'COMPLETED' ? null : state.currentActorId,
      updatedAt: new Date(Date.parse(state.updatedAt) + 1).toISOString()
    })
    const before = decodeCheckpointRecord('encounterRuns', stored)
    const next = decodeCheckpointRecord('encounterRuns', {
      ...stored,
      status,
      version: nextState.version,
      stateJson: canonicalizeJson(nextState),
      stateChecksum: checksumCanonicalJson(nextState),
      updatedAt: nextState.updatedAt
    })
    return recordChange('encounterRuns', [row.id], before, next)
  })
}

const readHolds = (base: Fixture) =>
  base.t.run((ctx) =>
    ctx.db
      .query('liveCharacterHolds')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
  )

/** Publishes one flush of `changes` on top of `authority`. */
async function publishNext(
  base: Fixture,
  authority: LiveSessionAuthorityDto,
  changes: LiveSessionCheckpointRecordChange[]
) {
  const committed = await base.t.mutation(publish, frame(authority, { changes, history: [] }))
  expect(committed.status).toBe('COMMITTED')
  return committed
}

const IO_COUNTERS = ['bytesRead', 'bytesWritten', 'documentsRead', 'documentsWritten'] as const

async function measureEnemyFlush(base: Fixture) {
  const authority = await activate(base)
  const committed = await publishNext(base, authority, [await enemyHitPointChange(base)])
  for (const counter of IO_COUNTERS)
    expect(
      Object.values(committed.io.sections).reduce((sum, section) => sum + section[counter], 0)
    ).toBe(committed.io[counter])
  expect(committed).not.toHaveProperty('authorization')
  return committed.io
}

it('reads the same bytes for a one-actor flush however many members and actors the Campaign has', async () => {
  const small = await measureEnemyFlush(await setupCharacterRun())
  const crowded = await setupCharacterRun()
  await crowded.t.run(async (ctx) => {
    for (let index = 0; index < 36; index++) {
      const userId = crypto.randomUUID()
      await ctx.db.insert('campaignMemberships', {
        campaignId: crowded.campaign.id,
        userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: crowded.campaign.createdAt,
        joinedAt: crowded.campaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: crowded.campaign.id,
        userId,
        characterId: crypto.randomUUID(),
        assignedAt: crowded.campaign.createdAt
      })
    }
  })
  expect(await measureEnemyFlush(crowded)).toEqual(small)

  const populated = await setupCharacterRun()
  const extraActors = 36
  await populated.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', populated.run.id))
      .unique()
    const enemy = populated.run.actors.find((actor) => actor.kind !== 'CHARACTER')
    const template = enemy
      ? await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', populated.run.id).eq('id', enemy.id)
          )
          .unique()
      : null
    if (!run || !template) throw new Error('Missing fixture Run.')
    const state = readRunState(run)
    const clones = Array.from({ length: extraActors }, () => crypto.randomUUID())
    for (const id of clones) {
      const { _id, _creationTime, ...fields } = template
      const cloneState = { ...readStoredRunActor(template), id }
      await ctx.db.insert('encounterRunActors', {
        ...fields,
        id,
        stateJson: canonicalizeJson(cloneState),
        stateChecksum: checksumCanonicalJson(runActorPlayState(cloneState))
      })
    }
    const nextState = encounterRunStateSchema.parse({
      ...state,
      actorIds: [...state.actorIds, ...clones]
    })
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(nextState),
      stateChecksum: checksumCanonicalJson(nextState)
    })
  })
  const withActors = await measureEnemyFlush(populated)
  // The Run row lists its actor ids; no actor document beyond the delta is read.
  expect(withActors.documentsRead).toBe(small.documentsRead)
  expect(withActors.bytesRead - small.bytesRead).toBeLessThan(extraActors * 100)
})

it('reconciles Character holds only when a hold input changes', async () => {
  const base = await setupCharacterRun()
  let authority = await activate(base)
  const flush = async (changes: LiveSessionCheckpointRecordChange[]) => {
    const committed = await publishNext(base, authority, changes)
    authority = committed.authority
    return committed.io.sections.holds
  }
  const actor = await characterActorChange(base)
  // A health change leaves every hold input alone and reads no actor.
  expect(await flush([await enemyHitPointChange(base)])).toMatchObject({
    documentsRead: 0,
    documentsWritten: 0
  })
  expect(await readHolds(base)).toEqual([])
  // START: the Run turns ACTIVE with an unfrozen Character actor.
  expect((await flush([await runStatusChange(base, 'ACTIVE')])).documentsRead).toBeGreaterThan(0)
  expect(await readHolds(base)).toMatchObject([
    {
      characterId: base.character.id,
      encounterId: base.run.id,
      epoch: authority.epoch
    }
  ])
  const held = await readHolds(base)
  expect(await flush([await enemyHitPointChange(base)])).toMatchObject({
    documentsRead: 0
  })
  expect(await readHolds(base)).toEqual(held)
  // Freezing the Character actor drops its hold.
  expect((await flush([actor.freeze])).documentsRead).toBeGreaterThan(0)
  expect(await readHolds(base)).toEqual([])
})

it('drops holds when the Run completes or the Character actor is removed', async () => {
  const completed = await setupCharacterRun()
  let authority = await activate(completed)
  authority = (
    await publishNext(completed, authority, [await runStatusChange(completed, 'ACTIVE')])
  ).authority
  expect(await readHolds(completed)).toHaveLength(1)
  await publishNext(completed, authority, [await runStatusChange(completed, 'COMPLETED')])
  expect(await readHolds(completed)).toEqual([])

  const removed = await setupCharacterRun()
  authority = await activate(removed)
  authority = (await publishNext(removed, authority, [await runStatusChange(removed, 'ACTIVE')]))
    .authority
  expect(await readHolds(removed)).toHaveLength(1)
  await publishNext(removed, authority, [
    await runStatusChange(removed, 'ACTIVE', removed.actor.id),
    (await characterActorChange(removed)).remove
  ])
  expect(await readHolds(removed)).toEqual([])
})

it('adopts the room-known PLAY and delta Character revisions only when they matched before the write', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const known = async () => {
    const revisions = await base.t.run((ctx) => ctx.db.query('sceneVisionRevisions').take(100))
    const read = (scope: string, id: string) =>
      revisions.find((row) => row.scope === scope && row.id === id)?.revision ?? null
    return {
      system: read('SYSTEM', base.campaign.gameSystemId),
      campaign: read('CAMPAIGN', base.campaign.id),
      play: read('PLAY', base.campaign.id),
      characters: [
        {
          characterId: base.character.id,
          revision: read('CHARACTER', base.character.id)
        }
      ],
      preferences: '0'.repeat(64)
    }
  }
  const run = await runChange(base)
  const play = await playChange(base)
  const matching = await known()
  const committed = await base.t.mutation(publish, {
    ...frame(authority, { changes: [run.change, play.change], history: [] }),
    knownAuthorization: matching
  })
  const after = await known()
  expect(committed.adopted).toEqual({
    play: after.play,
    characters: after.characters
  })
  expect(after.play).not.toBe(matching.play)
  expect(after.characters[0]!.revision).not.toBe(matching.characters[0]!.revision)

  // A revision the room did not hold before the write is left for its renewal read.
  const stale = await base.t.mutation(publish, {
    ...frame(committed.authority, {
      changes: [await enemyHitPointChange(base)],
      history: []
    }),
    knownAuthorization: { ...after, play: crypto.randomUUID(), characters: [] }
  })
  expect(stale.adopted).toEqual({ characters: [] })

  // Without a held cache there is nothing to adopt.
  const unknown = await publishNext(base, stale.authority, [await enemyHitPointChange(base)])
  expect(unknown.adopted).toEqual({ characters: [] })
})

it('refuses a checkpoint that starts a second active Run in the Campaign', async () => {
  const base = await setupCharacterRun()
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Second active Run fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Sibling target', maxHitPoints: 3 }]
  })
  const sibling = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await base.t.run((ctx) => activateFixtureRun(ctx, base.run.id))
  const authority = await activate(base)
  const change = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', sibling.id))
      .unique()
    if (!row) throw new Error('Missing sibling Run.')
    const { _id, _creationTime, ...stored } = row
    const state = readRunState(row)
    const active = {
      ...state,
      status: 'ACTIVE' as const,
      version: row.version + 1,
      round: 1,
      currentActorId: state.actorIds[0]!
    }
    return recordChange(
      'encounterRuns',
      [row.id],
      decodeCheckpointRecord('encounterRuns', stored),
      decodeCheckpointRecord('encounterRuns', {
        ...stored,
        status: 'ACTIVE',
        version: active.version,
        stateJson: canonicalizeJson(active),
        stateChecksum: checksumCanonicalJson(active)
      })
    )
  })
  const before = await snapshot(base)
  await expect(
    base.t.mutation(publish, frame(authority, { changes: [change], history: [] }))
  ).rejects.toThrow('Checkpoint starts a second active Encounter in the Campaign.')
  expect(await snapshot(base)).toEqual(before)
})

it('publishes paired chat checkpoints once and rolls back malformed scope, pairs and history collisions', async () => {
  const base = await setupCharacterRun()
  const foreign = await base.player.caller.mutation(createCampaign, {
    name: 'Foreign conversation checkpoint',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.campaign.gameSystemId,
    primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
  })
  const now = new Date().toISOString()
  const foreignConversationId = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('campaignConversations', {
      id: foreignConversationId,
      campaignId: foreign.id,
      kind: 'TABLE',
      participantUserIds: [],
      createdAt: now
    })
  )
  const authority = await activate(base)
  const run = await runChange(base)
  const conversation = campaignStoredConversationSchema.parse({
    id: crypto.randomUUID(),
    campaignId: base.campaign.id,
    kind: 'DIRECT',
    participantUserIds: [base.owner.userId, base.player.userId].sort(),
    createdAt: now
  })
  const member = campaignStoredConversationMemberSchema.parse({
    conversationId: conversation.id,
    campaignId: base.campaign.id,
    userId: base.owner.userId,
    accessStartedAt: now,
    lastReadAt: null
  })
  const chatPayload = campaignStoredEntryPayloadSchema.parse({
    entryId: crypto.randomUUID(),
    kind: 'CHAT',
    mode: 'ROLEPLAY',
    body: 'Retained message-time Character snapshot',
    roll: null,
    revealedByGm: false,
    authorUsername: 'Player snapshot',
    characterId: base.character.id,
    characterLabel: 'Departing Character',
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  const rollPayload = campaignStoredEntryPayloadSchema.parse({
    ...chatPayload,
    entryId: crypto.randomUUID(),
    kind: 'ROLL',
    mode: null,
    body: null,
    characterId: null,
    characterLabel: null,
    roll: {
      id: crypto.randomUUID(),
      normalizedExpression: '1d20',
      characterId: null,
      characterLabel: '',
      source: { kind: 'MANUAL', label: 'Checkpoint roll' },
      ruleset: { systemId: 'srd', code: 'srd', version: '1' },
      createdAt: now,
      evidence: {
        terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
        modifier: 0,
        mode: 'NORMAL',
        keep: 'FIRST',
        subtotal: 10,
        transform: { kind: 'NONE' },
        total: 10
      }
    }
  })
  const headerFor = (payload: typeof chatPayload, clientNonce = crypto.randomUUID()) =>
    createCampaignEntryHeader(
      {
        id: payload.entryId,
        campaignId: base.campaign.id,
        conversationId: conversation.id,
        authorUserId: base.owner.userId,
        clientNonce,
        createdAt: now
      },
      payload
    )
  const chatNonce = crypto.randomUUID()
  const chatHeader = headerFor(chatPayload, chatNonce)
  const rollHeader = headerFor(rollPayload)
  const create = (
    table: LiveSessionCheckpointTable,
    key: string[],
    fields: Record<string, unknown>
  ) => recordChange(table, key, null, decodeCheckpointRecord(table, fields))
  const input = frame(authority, {
    changes: [
      run.change,
      create('campaignConversationEntryPayloads', [chatPayload.entryId], chatPayload),
      create('campaignConversationEntryPayloads', [rollPayload.entryId], rollPayload),
      create('campaignConversationEntries', [chatHeader.id], chatHeader),
      create('campaignConversationEntries', [rollHeader.id], rollHeader),
      create('campaignConversationMembers', [member.conversationId, member.userId], member),
      create('campaignConversations', [conversation.id], conversation)
    ],
    history: []
  })
  const retained = async () => ({
    product: await snapshot(base),
    chat: await base.t.run(async (ctx) => ({
      conversations: await ctx.db.query('campaignConversations').collect(),
      members: await ctx.db.query('campaignConversationMembers').collect(),
      headers: await ctx.db.query('campaignConversationEntries').collect(),
      payloads: await ctx.db.query('campaignConversationEntryPayloads').collect()
    }))
  })
  const committed = await base.t.mutation(publish, input)
  expect(committed.status).toBe('COMMITTED')
  const after = await retained()
  expect(after.chat.headers).toHaveLength(2)
  expect(after.chat.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining(chatHeader),
      expect.objectContaining(rollHeader)
    ])
  )
  expect(after.chat.payloads).toHaveLength(2)
  expect((await base.t.mutation(publish, input)).status).toBe('REPLAYED')
  expect(await retained()).toEqual(after)

  await base.t.run(async (ctx) => {
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
      .unique()
    if (!assignment) throw new Error('Missing Character assignment fixture.')
    await ctx.db.delete(assignment._id)
  })
  const editedAt = new Date(Date.parse(now) + 1_000).toISOString()
  const editedChat = {
    ...chatPayload,
    body: 'Edited after Character departure',
    editedAt
  }
  const revealedRoll = {
    ...rollPayload,
    revealedByGm: true,
    consumedAt: editedAt
  }
  const edited = await base.t.mutation(
    publish,
    frame(committed.authority, {
      changes: [
        recordChange(
          'campaignConversationEntryPayloads',
          [chatPayload.entryId],
          decodeCheckpointRecord('campaignConversationEntryPayloads', chatPayload),
          decodeCheckpointRecord('campaignConversationEntryPayloads', editedChat)
        ),
        recordChange(
          'campaignConversationEntryPayloads',
          [rollPayload.entryId],
          decodeCheckpointRecord('campaignConversationEntryPayloads', rollPayload),
          decodeCheckpointRecord('campaignConversationEntryPayloads', revealedRoll)
        ),
        recordChange(
          'campaignConversationMembers',
          [member.conversationId, member.userId],
          decodeCheckpointRecord('campaignConversationMembers', member),
          null
        )
      ],
      history: []
    })
  )
  const afterEdit = await retained()
  expect(afterEdit.chat.headers).toEqual(after.chat.headers)
  expect(afterEdit.chat.members).toEqual([])
  for (const payload of afterEdit.chat.payloads)
    expect(payload._id).toBe(
      after.chat.payloads.find((prior) => prior.entryId === payload.entryId)?._id
    )
  expect(afterEdit.chat.payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining(editedChat),
      expect.objectContaining(revealedRoll)
    ])
  )
  const nextRun = await runChange(base)
  const newPayload = { ...chatPayload, entryId: crypto.randomUUID() }
  const newHeader = headerFor(newPayload)
  const nonceCollisionHeader = headerFor(newPayload, chatNonce)
  const foreignNewConversationId = crypto.randomUUID()
  const danglingConversationId = crypto.randomUUID()
  const secondPayload = { ...chatPayload, entryId: crypto.randomUUID() }
  const frameNonce = crypto.randomUUID()
  const variants: [LiveSessionCheckpointRecordChange[], string][] = [
    [
      [
        create('campaignConversations', [foreignNewConversationId], {
          ...conversation,
          id: foreignNewConversationId,
          campaignId: foreign.id
        })
      ],
      'another Campaign'
    ],
    [
      [
        create('campaignConversationMembers', [foreignConversationId, base.owner.userId], {
          ...member,
          conversationId: foreignConversationId
        })
      ],
      'another Campaign'
    ],
    [
      [
        create('campaignConversationMembers', [danglingConversationId, base.owner.userId], {
          ...member,
          conversationId: danglingConversationId
        })
      ],
      'conversation is missing'
    ],
    [
      [create('campaignConversationEntryPayloads', [newPayload.entryId], newPayload)],
      'entry is missing'
    ],
    [[create('campaignConversationEntries', [newHeader.id], newHeader)], 'payload is missing'],
    [
      [
        create('campaignConversationEntryPayloads', [newPayload.entryId], newPayload),
        create('campaignConversationEntries', [newHeader.id], {
          ...newHeader,
          kind: 'ROLL',
          rollNonceFingerprint: 'f'.repeat(64)
        })
      ],
      'nonce evidence'
    ],
    [
      [
        create('campaignConversationEntryPayloads', [newPayload.entryId], newPayload),
        create('campaignConversationEntries', [newHeader.id], nonceCollisionHeader)
      ],
      'nonce already exists'
    ],
    [
      [
        create('campaignConversationEntryPayloads', [newPayload.entryId], newPayload),
        create('campaignConversationEntryPayloads', [secondPayload.entryId], secondPayload),
        create(
          'campaignConversationEntries',
          [newPayload.entryId],
          headerFor(newPayload, frameNonce)
        ),
        create(
          'campaignConversationEntries',
          [secondPayload.entryId],
          headerFor(secondPayload, frameNonce)
        )
      ],
      'nonce already exists'
    ],
    [
      [
        create('campaignConversations', [newPayload.entryId], {
          ...conversation,
          id: newPayload.entryId
        })
      ],
      'identity already exists'
    ],
    [
      [
        create('campaignConversations', [newPayload.entryId], {
          ...conversation,
          id: newPayload.entryId,
          kind: 'PARTY',
          participantUserIds: []
        }),
        create('campaignConversations', [secondPayload.entryId], {
          ...conversation,
          id: secondPayload.entryId,
          kind: 'PARTY',
          participantUserIds: []
        })
      ],
      'identity already exists'
    ],
    [
      [create('campaignConversationEntries', [chatHeader.id], chatHeader)],
      'changed before publication'
    ],
    [
      [
        recordChange(
          'campaignConversationEntries',
          [chatHeader.id],
          decodeCheckpointRecord('campaignConversationEntries', chatHeader),
          decodeCheckpointRecord('campaignConversationEntries', {
            ...chatHeader,
            createdAt: editedAt
          })
        )
      ],
      'immutable'
    ],
    [
      [
        recordChange(
          'campaignConversations',
          [conversation.id],
          decodeCheckpointRecord('campaignConversations', conversation),
          decodeCheckpointRecord('campaignConversations', {
            ...conversation,
            createdAt: editedAt
          })
        )
      ],
      'immutable'
    ],
    [
      [
        recordChange(
          'campaignConversationEntryPayloads',
          [chatPayload.entryId],
          decodeCheckpointRecord('campaignConversationEntryPayloads', editedChat),
          decodeCheckpointRecord('campaignConversationEntryPayloads', {
            ...editedChat,
            characterLabel: 'Rewritten message-time Character'
          })
        )
      ],
      'message-time snapshots are immutable'
    ],
    [
      [
        recordChange(
          'campaignConversationEntryPayloads',
          [rollPayload.entryId],
          decodeCheckpointRecord('campaignConversationEntryPayloads', revealedRoll),
          decodeCheckpointRecord('campaignConversationEntryPayloads', {
            ...revealedRoll,
            authorUsername: 'Changed roll retry evidence'
          })
        )
      ],
      'nonce evidence'
    ]
  ]
  for (const [table, key, fields] of [
    ['campaignConversations', conversation.id, conversation],
    ['campaignConversationEntries', chatHeader.id, chatHeader],
    ['campaignConversationEntryPayloads', chatPayload.entryId, editedChat]
  ] as const)
    variants.push([
      [recordChange(table, [key], decodeCheckpointRecord(table, fields), null)],
      'retained conversation history'
    ])
  const beforeFailures = await retained()
  for (const [changes, error] of variants) {
    await expect(
      base.t.mutation(
        publish,
        frame(edited.authority, {
          changes: [nextRun.change, ...changes],
          history: []
        })
      )
    ).rejects.toThrow(error)
    expect(await retained()).toEqual(beforeFailures)
  }
})

it('rolls back state, partial packed history and authority when a receipt collides', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const existing = characterHistory(base)
  const first = await base.t.mutation(
    publish,
    frame(authority, { changes: [], history: [existing] })
  )
  const run = await runChange(base)
  const input = frame(first.authority, {
    changes: [run.change],
    history: [existing]
  })
  const before = await snapshot(base)
  await expect(base.t.mutation(publish, input)).rejects.toThrow(
    'Receipt header identity already exists'
  )
  expect(await snapshot(base)).toEqual(before)
})

it('rejects Encounter history entries by contract', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const run = await runChange(base)
  const input = frame(authority, { changes: [run.change], history: [] })
  const entry = encounterHistory(base, run.nextStored.version)
  expect(
    liveSessionCheckpointRecordsSchema.safeParse({ ...input.records, history: [entry] }).success
  ).toBe(false)
})

it('rolls back the entire checkpoint when deleting a required part of a surviving pending snapshot', async () => {
  const base = await nativeDisarmFixture('PROMPT')
  const started = await disarmInRoom(base.owner, base.command)
  if (started.occurrence?.status !== 'PENDING')
    throw new Error('Expected pending Disarm occurrence.')
  const occurrenceId = started.occurrence.occurrenceId
  // The room holds the pending occurrence until it checkpoints (D85).
  await checkpointLiveRoom(base.campaign.id)
  const pending = await base.t.run(async (ctx) => {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
      .unique()
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    if (!occurrence || !authority) throw new Error('Missing pending fixture or live authority.')
    const storedSnapshot = await readPendingSnapshot(
      { db: createConvexEncounterStoreReader(ctx) },
      occurrence
    )
    expect(storedSnapshot).not.toBeNull()
    expect(checksumCanonicalJson(storedSnapshot)).toBe(occurrence.pendingSnapshotChecksum)
    const parts = await ctx.db
      .query('encounterPendingSnapshotParts')
      .withIndex('by_occurrenceId_sequence', (q) => q.eq('occurrenceId', occurrence.id))
      .take(2)
    expect(parts).toHaveLength(1)
    const part = parts[0]
    if (!part) throw new Error('Missing required pending snapshot part.')
    const { _id, _creationTime, ...stored } = part
    return {
      authority: presentCampaignLiveAuthority(authority),
      deletion: recordChange(
        'encounterPendingSnapshotParts',
        [part.occurrenceId, part.sequence],
        decodeCheckpointRecord('encounterPendingSnapshotParts', stored),
        null
      )
    }
  })
  const run = await runChange(base)
  const play = await playChange(base)
  const input = frame(pending.authority, {
    changes: [run.change, play.change, pending.deletion],
    history: [characterHistory(base)]
  })
  const before = await snapshot(base)
  expect(before.occurrences.find((row) => row.id === occurrenceId)?.state).toBe('PENDING')
  expect(input.payloadChecksum).toBe(checksumCanonicalJson(input.records))
  await expect(base.t.mutation(publish, input)).rejects.toThrow('Pending snapshot is unavailable.')
  expect(await snapshot(base)).toEqual(before)
})

it('rejects foreign Campaign records and history and Character play not held by that Campaign', async () => {
  const base = await setupCharacterRun()
  const foreignCampaign = await base.player.caller.mutation(createCampaign, {
    name: 'Foreign checkpoint Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.campaign.gameSystemId,
    primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
  })
  const foreignClaim = await base.player.caller.mutation(claim, {
    campaignId: foreignCampaign.id
  })
  const foreignAuthority = await base.t.mutation(commitActivation, {
    campaignId: foreignCampaign.id,
    epoch: foreignClaim.epoch,
    activationFingerprint: foreignClaim.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
  })
  const run = await runChange(base)
  const play = await playChange(base)
  const before = await snapshot(base)
  const cases: [FixtureRecords, string][] = [
    [{ changes: [run.change], history: [] }, 'another Campaign'],
    [{ changes: [play.change], history: [] }, 'Character is not held by this Campaign'],
    [{ changes: [], history: [characterHistory(base)] }, 'Character is not held by this Campaign']
  ]
  for (const [records, error] of cases) {
    await expect(base.t.mutation(publish, frame(foreignAuthority, records))).rejects.toThrow(error)
    expect(await snapshot(base)).toEqual(before)
  }
})

it('rejects stale record and delta checksums, altered payloads, malformed input and stored JSON', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const run = await runChange(base)
  const input = frame(authority, { changes: [run.change], history: [] })
  const before = await snapshot(base)
  const variants: [LiveSessionCheckpointRequest, string | undefined][] = [
    [{ ...input, payloadChecksum: 'f'.repeat(64) }, 'payload checksum does not match'],
    [{ ...input, fromSequence: 0.5 }, undefined],
    [{ ...input, epoch: crypto.randomUUID() }, 'authority is stale'],
    [
      frame(authority, {
        changes: [{ ...run.change, previousChecksum: 'f'.repeat(64) }],
        history: []
      }),
      'record changed before publication'
    ],
    [
      frame(authority, {
        changes: [{ ...run.change, nextChecksum: 'f'.repeat(64) }],
        history: []
      }),
      'delta checksum does not match'
    ],
    [
      frame(authority, { changes: [run.change, run.change], history: [] }),
      'identity is duplicated'
    ],
    [
      frame(authority, {
        changes: [
          recordChange(
            'encounterRuns',
            [run.row.id],
            run.before,
            decodeCheckpointRecord('encounterRuns', {
              ...run.nextStored,
              stateChecksum: 'f'.repeat(64)
            })
          )
        ],
        history: []
      }),
      'Stored Encounter policy snapshot mismatch'
    ]
  ]
  for (const [variant, error] of variants) {
    await expect(base.t.mutation(publish, variant)).rejects.toThrow(error)
    expect(await snapshot(base)).toEqual(before)
  }
  await base.t.run((ctx) => ctx.db.patch(run.row._id, { stateJson: 'malformed JSON' }))
  const corrupted = await snapshot(base)
  await expect(base.t.mutation(publish, input)).rejects.toThrow()
  expect(await snapshot(base)).toEqual(corrupted)
})

it('refuses Character play insertion, deletion, a stale clock and mismatched play content checksum', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const play = await playChange(base)
  const before = await snapshot(base)
  const insertedCharacterId = crypto.randomUUID()
  const cases: [LiveSessionCheckpointRecordChange, string][] = [
    [
      recordChange('characterPlayStates', [insertedCharacterId], null, {
        ...play.next,
        characterId: insertedCharacterId
      }),
      'cannot create or delete Character play state'
    ],
    [
      recordChange('characterPlayStates', [base.character.id], play.before, null),
      'cannot create or delete Character play state'
    ],
    [
      recordChange('characterPlayStates', [base.character.id], play.before, {
        ...play.next,
        streamVersion: play.row.streamVersion
      }),
      'play version must advance'
    ],
    [
      recordChange('characterPlayStates', [base.character.id], play.before, {
        ...play.next,
        checksum: play.row.checksum
      }),
      'Character play checksum does not match'
    ]
  ]
  for (const [change, error] of cases) {
    await expect(
      base.t.mutation(publish, frame(authority, { changes: [change], history: [] }))
    ).rejects.toThrow(error)
    expect(await snapshot(base)).toEqual(before)
  }
})

/** A one-d20 roll in `system`, created at the epoch millisecond `at`. */
function makeRetainedRoll(
  system: { id: string; rulesetCode: string; rulesetVersion: string },
  at: number
) {
  return rollRecordDtoSchema.parse({
    id: crypto.randomUUID(),
    normalizedExpression: '1d20',
    characterId: null,
    characterLabel: '',
    source: { kind: 'MANUAL', label: 'Retained private checkpoint roll' },
    ruleset: {
      systemId: system.id,
      code: system.rulesetCode,
      version: system.rulesetVersion
    },
    createdAt: new Date(at).toISOString(),
    evidence: {
      terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
      modifier: 0,
      mode: 'NORMAL',
      keep: 'FIRST',
      subtotal: 10,
      transform: { kind: 'NONE' },
      total: 10
    }
  })
}

it('merges private checkpoint rolls into global owner history without changing replayed evidence or leaking invalid frames', async () => {
  const base = await setupCharacterRun()
  await base.t.run((ctx) =>
    ctx.db.insert('accountEntitlements', {
      userId: base.owner.userId,
      tier: 'PRO_GM'
    })
  )
  const foreign = await base.owner.caller.mutation(createCampaign, {
    name: 'Other retained-roll Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.campaign.gameSystemId,
    primaryRulesCatalogueId: base.campaign.primaryRulesCatalogueId
  })
  const system = await base.t.run((ctx) => requireSystem(ctx, base.campaign.gameSystemId))
  const startedAt = Date.now()
  const makeRoll = (ordinal: number) => makeRetainedRoll(system, startedAt + ordinal)
  const existing = makeRoll(19)
  const seed = Array.from({ length: 19 }, (_, index) => ({
    record: makeRoll(index),
    gmCampaignRoll: {
      campaignId: foreign.id,
      creature: null,
      revealedAt: null,
      noticedAt: null
    }
  })).concat([
    {
      record: existing,
      gmCampaignRoll: {
        campaignId: base.campaign.id,
        creature: null,
        revealedAt: null,
        noticedAt: null
      }
    }
  ])
  const revealedAt = new Date(startedAt + 100).toISOString()
  await base.t.run(async (ctx) => {
    await retainUserRolls(ctx, base.owner.userId, seed)
    const row = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (q) => q.eq('userId', base.owner.userId).eq('id', existing.id))
      .unique()
    if (!row) throw new Error('Missing retained-roll fixture.')
    await ctx.db.patch(row._id, {
      consumedAt: revealedAt,
      gmCampaignRoll: {
        campaignId: base.campaign.id,
        creature: null,
        revealedAt,
        noticedAt: null
      }
    })
  })
  const retained = () =>
    base.t.run(async (ctx) => ({
      owner: await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', base.owner.userId))
        .order('desc')
        .take(21),
      player: await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', base.player.userId))
        .order('desc')
        .take(21),
      chat: await ctx.db.query('campaignConversationEntries').take(100)
    }))
  const before = await retained()
  const first = makeRoll(20)
  const second = makeRoll(21)
  const incoming: LiveSessionCheckpointRetainedRoll[] = [first, second, existing].map((record) => ({
    userId: base.owner.userId,
    record,
    gmCampaignRoll: {
      campaignId: base.campaign.id,
      creature: null,
      revealedAt: null,
      noticedAt: null
    }
  }))
  const authority = await activate(base)
  const run = await runChange(base)
  const input = frame(authority, {
    changes: [run.change],
    history: [],
    retainedRolls: incoming
  })
  const committed = await base.t.mutation(publish, input)
  const after = await retained()
  expect(committed.status).toBe('COMMITTED')
  expect(after.owner).toHaveLength(20)
  expect(after.owner.map((row) => row.id)).toEqual([
    second.id,
    first.id,
    existing.id,
    ...seed
      .slice(2, 19)
      .reverse()
      .map(({ record }) => record.id)
  ])
  expect(after.owner.filter((row) => row.gmCampaignRoll?.campaignId === foreign.id)).toHaveLength(
    17
  )
  expect(after.owner.find((row) => row.id === existing.id)).toMatchObject({
    consumedAt: revealedAt,
    gmCampaignRoll: {
      campaignId: base.campaign.id,
      creature: null,
      revealedAt,
      noticedAt: null
    }
  })
  expect(after.player).toEqual(before.player)
  expect(after.chat).toEqual(before.chat)
  const beforeReplay = await snapshot(base)
  expect((await base.t.mutation(publish, input)).status).toBe('REPLAYED')
  expect(await snapshot(base)).toEqual(beforeReplay)
  expect(await retained()).toEqual(after)

  // A later prefix also merges existing IDs without replacing their native storage rows.
  const nextRun = await runChange(base)
  const merged = await base.t.mutation(
    publish,
    frame(committed.authority, {
      changes: [nextRun.change],
      history: [],
      retainedRolls: incoming
    })
  )
  expect(await retained()).toEqual(after)

  const staged = { ...incoming[0], record: makeRoll(22) }
  const altered = {
    ...incoming[0],
    record: { ...first, source: { ...first.source, label: 'Changed roll' } }
  }
  const cases: [LiveSessionCheckpointRetainedRoll[], string][] = [
    [[staged, { ...incoming[0], userId: base.player.userId }], 'another owner, Campaign or System'],
    [
      [
        staged,
        {
          ...incoming[0],
          record: {
            ...first,
            ruleset: { ...first.ruleset, systemId: crypto.randomUUID() }
          }
        }
      ],
      'another owner, Campaign or System'
    ],
    [
      [
        staged,
        {
          ...incoming[0],
          gmCampaignRoll: {
            campaignId: foreign.id,
            creature: null,
            revealedAt: null,
            noticedAt: null
          }
        }
      ],
      'another owner, Campaign or System'
    ],
    [
      [
        staged,
        {
          ...staged,
          record: {
            ...staged.record,
            source: { ...staged.record.source, label: 'Duplicate mismatch' }
          }
        }
      ],
      'identity is duplicated'
    ],
    [[staged, altered], 'identity is reused'],
    [[staged, { ...incoming[0], record: seed[2].record }], 'identity is reused']
  ]
  const finalRun = await runChange(base)
  const finalState = await snapshot(base)
  for (const [retainedRolls, error] of cases) {
    await expect(
      base.t.mutation(
        publish,
        frame(merged.authority, {
          changes: [finalRun.change],
          history: [],
          retainedRolls
        })
      )
    ).rejects.toThrow(error)
    expect(await snapshot(base)).toEqual(finalState)
    expect(await retained()).toEqual(after)
  }
})

it("retains an active member's own private checkpoint roll and refuses a copy that does not belong", async () => {
  const base = await setupCharacterRun()
  const system = await base.t.run((ctx) => requireSystem(ctx, base.campaign.gameSystemId))
  const startedAt = Date.now()
  const makeRoll = (ordinal: number) => makeRetainedRoll(system, startedAt + ordinal)
  const binding = {
    campaignId: base.campaign.id,
    creature: null,
    revealedAt: null,
    noticedAt: null
  }
  const copy: LiveSessionCheckpointRetainedRoll = {
    userId: base.player.userId,
    record: makeRoll(0),
    gmCampaignRoll: null
  }
  const historyOf = (userId: string) =>
    base.t.run((ctx) =>
      ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
        .take(21)
    )

  const authority = await activate(base)
  const run = await runChange(base)
  const input = frame(authority, {
    changes: [run.change],
    history: [],
    retainedRolls: [copy]
  })
  const committed = await base.t.mutation(publish, input)
  expect(committed.status).toBe('COMMITTED')
  expect(await historyOf(base.player.userId)).toEqual([
    expect.objectContaining({ id: copy.record.id, gmCampaignRoll: null })
  ])
  expect(await historyOf(base.owner.userId)).toEqual([])
  const afterCommit = await snapshot(base)
  expect((await base.t.mutation(publish, input)).status).toBe('REPLAYED')
  expect(await snapshot(base)).toEqual(afterCommit)

  // Rows that exist with the opposite binding: a bound member row and an unbound owner row.
  const boundMemberRoll = makeRoll(1)
  const unboundOwnerRoll = makeRoll(2)
  await base.t.run(async (ctx) => {
    await retainUserRolls(ctx, base.player.userId, [
      { record: boundMemberRoll, gmCampaignRoll: binding }
    ])
    await retainUserRolls(ctx, base.owner.userId, [
      { record: unboundOwnerRoll, gmCampaignRoll: null }
    ])
  })
  const beforeRejections = await snapshot(base)
  const playerBefore = await historyOf(base.player.userId)
  const ownerBefore = await historyOf(base.owner.userId)
  const cases: [LiveSessionCheckpointRetainedRoll[], string][] = [
    [[{ ...copy, record: makeRoll(3), userId: crypto.randomUUID() }], 'another owner'],
    [[{ ...copy, record: makeRoll(4), gmCampaignRoll: binding }], 'another owner'],
    [[{ userId: base.owner.userId, record: makeRoll(5), gmCampaignRoll: null }], 'another owner'],
    [
      [
        { ...copy, record: { ...copy.record, source: { ...copy.record.source, label: 'Changed' } } }
      ],
      'identity is reused'
    ],
    [[{ ...copy, record: boundMemberRoll }], 'identity is reused'],
    [
      [{ userId: base.owner.userId, record: unboundOwnerRoll, gmCampaignRoll: binding }],
      'identity is reused'
    ]
  ]
  const finalRun = await runChange(base)
  for (const [retainedRolls, error] of cases) {
    await expect(
      base.t.mutation(
        publish,
        frame(committed.authority, { changes: [finalRun.change], history: [], retainedRolls })
      )
    ).rejects.toThrow(error)
    expect(await snapshot(base)).toEqual(beforeRejections)
    expect(await historyOf(base.player.userId)).toEqual(playerBefore)
    expect(await historyOf(base.owner.userId)).toEqual(ownerBefore)
  }

  // A member who left the Campaign no longer keeps new copies.
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  const afterLeaving = await snapshot(base)
  await expect(
    base.t.mutation(
      publish,
      frame(committed.authority, {
        changes: [finalRun.change],
        history: [],
        retainedRolls: [{ ...copy, record: makeRoll(6) }]
      })
    )
  ).rejects.toThrow('another owner')
  expect(await snapshot(base)).toEqual(afterLeaving)
  expect(await historyOf(base.player.userId)).toEqual(playerBefore)
})
