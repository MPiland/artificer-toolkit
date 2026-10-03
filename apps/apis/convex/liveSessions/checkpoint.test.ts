import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  LiveSessionCheckpointInput,
  LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import {
  liveSessionCheckpointHistoryKeyFields,
  type LiveSessionCheckpointHistoryEntry,
  type LiveSessionCheckpointHistoryTable,
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
import { diffJson } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { createCampaign } from '../../tests/fixtures/encounterScene'
import { disarmInRoom, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readReceiptHeaders, readReceiptLedger } from '../lib/receiptLedgers'
import { withSceneVisionTracking } from '../lib/mutations'
import { presentCampaignLiveAuthority } from './authority'
import { requireSystem } from '../content/systemDocuments'
import { retainUserRolls } from '../rollDocuments'
import {
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema,
  campaignStoredEntryPayloadSchema,
  createCampaignEntryHeader
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'

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
  LiveSessionCheckpointInput,
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
  table: LiveSessionCheckpointHistoryTable,
  fields: Record<string, unknown>
): LiveSessionCheckpointHistoryEntry {
  const value = decodeCheckpointRecord(table, fields)
  return {
    table,
    key: liveSessionCheckpointHistoryKeyFields[table].map((field) => {
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
): LiveSessionCheckpointInput {
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
      hitpoints: { ...row.state.hitpoints, current: row.state.hitpoints.current - 1 },
      partyVisibility: { ...row.state.partyVisibility, sheet: !row.state.partyVisibility.sheet }
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

function sharedHistory(base: Fixture, version: number) {
  const createdAt = base.campaign.createdAt
  const replay = { roll: null, occurrence: null }
  const result = { settled: true }
  return [
    historyEntry('encounterRunCommands', {
      id: crypto.randomUUID(),
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      commandFingerprint: 'c'.repeat(64),
      actorUserId: base.owner.userId,
      createdAt,
      visibility: 'TABLE',
      commandType: 'UPSERT_REMINDER',
      version,
      commandJson: canonicalizeJson({ type: 'UPSERT_REMINDER', label: 'Checkpoint reminder' }),
      replayReceiptJson: canonicalizeJson(replay),
      replayReceiptChecksum: checksumCanonicalJson(replay)
    }),
    historyEntry('encounterRuleReceipts', {
      id: crypto.randomUUID(),
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      occurrenceId: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: 'd'.repeat(64),
      encounterVersion: version,
      commandMetadataJson: canonicalizeJson({ label: 'Checkpoint effect' }),
      resultJson: canonicalizeJson(result),
      resultChecksum: checksumCanonicalJson(result),
      actorUserId: base.owner.userId,
      correlationId: null,
      createdAt
    })
  ]
}

function characterHistory(base: Fixture) {
  const history = { label: 'Checkpoint play update' }
  return historyEntry('characterCommandReceipts', {
    id: crypto.randomUUID(),
    characterId: base.character.id,
    commandId: crypto.randomUUID(),
    actorId: base.player.userId,
    commandFingerprint: 'e'.repeat(64),
    occurredAt: base.campaign.createdAt,
    historyJson: canonicalizeJson(history),
    historyChecksum: checksumCanonicalJson(history)
  })
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

it('publishes Run and Character play deltas with grouped history, then replays without state or ledger writes', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const run = await runChange(base)
  const play = await playChange(base)
  const shared = sharedHistory(base, run.nextStored.version)
  const privateHistory = characterHistory(base)
  const input = frame(authority, {
    changes: [run.change, play.change],
    history: [shared[0]!, privateHistory, shared[1]!]
  })
  const before = await snapshot(base)
  const beforeCharacterRevision = before.revisions.find(
    (row) => row.scope === 'CHARACTER' && row.id === base.character.id
  )
  if (!beforeCharacterRevision) throw new Error('Missing fixture Character revision.')
  const committed = await base.t.mutation(publish, input)
  expect(committed.status).toBe('COMMITTED')
  expect(committed.authority).toMatchObject({
    persistedSequence: 3,
    persistedStateChecksum: input.checksum,
    lastCheckpoint: { checkpointId: input.checkpointId, payloadChecksum: input.payloadChecksum }
  })
  expect(committed.authorization.campaign?.assignments).toContainEqual({
    characterId: base.character.id,
    userId: base.player.userId
  })
  expect(committed.authorization.characters).toContainEqual({
    characterId: base.character.id,
    ownerUserId: base.player.userId,
    partyVisibility: play.nextState.partyVisibility
  })
  const after = await snapshot(base)
  const afterCharacterRevision = after.revisions.find(
    (row) => row.scope === 'CHARACTER' && row.id === base.character.id
  )
  if (!afterCharacterRevision) throw new Error('Missing published Character revision.')
  expect(afterCharacterRevision.revision).not.toBe(beforeCharacterRevision.revision)
  expect(committed.authorization.revisions.characters).toContainEqual({
    characterId: base.character.id,
    revision: afterCharacterRevision.revision
  })
  expect(after.invalidations).toEqual(before.invalidations)
  expect(after.run).toEqual({ ...run.row, ...run.nextStored })
  expect(after.play).toEqual({ ...play.row, ...play.next })
  const checkpointLedgers = after.ledgers.filter(
    (ledger) => ledger.checkpointId === input.checkpointId
  )
  expect(checkpointLedgers).toHaveLength(2)
  expect(checkpointLedgers.map(({ scope, scopeId }) => [scope, scopeId])).toEqual([
    ['CAMPAIGN', base.campaign.id],
    ['CHARACTER', base.character.id]
  ])
  await base.t.run(async (ctx) => {
    for (const ledger of checkpointLedgers) {
      const decoded = await readReceiptLedger(ctx, ledger.id)
      expect(decoded.metadata.epoch).toBe(input.epoch)
      expect(decoded.entries).toEqual(ledger.scope === 'CAMPAIGN' ? shared : [privateHistory])
    }
    const runHeader = after.runHeaders.find(
      (header) => header.commandId === shared[0]!.value.commandId
    )
    const ruleHeader = after.ruleHeaders.find(
      (header) => header.commandId === shared[1]!.value.commandId
    )
    const characterHeader = after.characterHeaders.find(
      (header) => header.commandId === privateHistory.value.commandId
    )
    if (!runHeader || !ruleHeader || !characterHeader)
      throw new Error('Missing checkpoint headers.')
    expect(runHeader.ledgerId).toBe(ruleHeader.ledgerId)
    expect(characterHeader.ledgerId).not.toBe(runHeader.ledgerId)
    const [logicalRun] = await readReceiptHeaders(ctx, 'encounterRunCommands', [runHeader])
    const [logicalRule] = await readReceiptHeaders(ctx, 'encounterRuleReceipts', [ruleHeader])
    const [logicalCharacter] = await readReceiptHeaders(ctx, 'characterCommandReceipts', [
      characterHeader
    ])
    if (!logicalRun || !logicalRule || !logicalCharacter)
      throw new Error('Missing logical receipts.')
    const { _id: _runId, _creationTime: _runTime, ...runFields } = logicalRun
    const { _id: _ruleId, _creationTime: _ruleTime, ...ruleFields } = logicalRule
    const {
      _id: _characterId,
      _creationTime: _characterTime,
      ...characterFields
    } = logicalCharacter
    expect(decodeCheckpointRecord('encounterRunCommands', runFields)).toEqual(shared[0]!.value)
    expect(decodeCheckpointRecord('encounterRuleReceipts', ruleFields)).toEqual(shared[1]!.value)
    expect(decodeCheckpointRecord('characterCommandReceipts', characterFields)).toEqual(
      privateHistory.value
    )
  })

  await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
      .unique()
    if (!profile) throw new Error('Missing fixture profile.')
    await ctx.db.patch(profile._id, { autoRollDice: !profile.autoRollDice })
  })
  const beforeReplay = await snapshot(base)
  vi.useFakeTimers()
  vi.setSystemTime(Date.now() + 1_000)
  const replayed = await base.t.mutation(publish, {
    ...input,
    knownAuthorization: committed.authorization.revisions
  })
  expect(replayed.status).toBe('REPLAYED')
  expect(replayed.authority).toEqual(committed.authority)
  expect(replayed.authorization.revisions.preferences).not.toBe(
    committed.authorization.revisions.preferences
  )
  expect(replayed.authorization.preferences).toBeDefined()
  expect(replayed.authorization.campaign).toBeUndefined()
  expect(replayed.authorization.play).toBeUndefined()
  expect(replayed.authorization.characters).toEqual([])
  expect(await snapshot(base)).toEqual(beforeReplay)
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
  const editedChat = { ...chatPayload, body: 'Edited after Character departure', editedAt }
  const revealedRoll = { ...rollPayload, revealedByGm: true, consumedAt: editedAt }
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
          decodeCheckpointRecord('campaignConversations', { ...conversation, createdAt: editedAt })
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

it('rolls back state, partial packed history and authority when a later receipt collides', async () => {
  const base = await setupCharacterRun()
  const authority = await activate(base)
  const run = await runChange(base)
  const existing = await base.t.run(async (ctx) => {
    const header = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
      .first()
    if (!header) throw new Error('Missing fixture creation receipt.')
    const [logical] = await readReceiptHeaders(ctx, 'encounterRunCommands', [header])
    if (!logical) throw new Error('Missing logical creation receipt.')
    const { _id, _creationTime, ...fields } = logical
    return historyEntry('encounterRunCommands', fields)
  })
  const input = frame(authority, {
    changes: [run.change],
    history: [sharedHistory(base, run.nextStored.version)[0]!, existing]
  })
  const before = await snapshot(base)
  await expect(base.t.mutation(publish, input)).rejects.toThrow(
    'Receipt header identity already exists'
  )
  expect(await snapshot(base)).toEqual(before)
})

it('rolls back the entire checkpoint when deleting a required part of a surviving pending snapshot', async () => {
  const base = await nativeDisarmFixture('PROMPT')
  const started = await disarmInRoom(base, base.owner, base.command)
  if (started.occurrence?.status !== 'PENDING')
    throw new Error('Expected pending Disarm occurrence.')
  const occurrenceId = started.occurrence.occurrenceId
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
    history: [...sharedHistory(base, run.nextStored.version), characterHistory(base)]
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
  const foreignClaim = await base.player.caller.mutation(claim, { campaignId: foreignCampaign.id })
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
    [{ changes: [], history: sharedHistory(base, run.nextStored.version) }, 'another Campaign'],
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
  const variants: [LiveSessionCheckpointInput, string | undefined][] = [
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
        history: sharedHistory(base, run.nextStored.version)
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

it('merges private checkpoint rolls into global owner history without changing replayed evidence or leaking invalid frames', async () => {
  const base = await setupCharacterRun()
  await base.t.run((ctx) =>
    ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
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
  const makeRoll = (ordinal: number) =>
    rollRecordDtoSchema.parse({
      id: crypto.randomUUID(),
      normalizedExpression: '1d20',
      characterId: null,
      characterLabel: '',
      source: { kind: 'MANUAL', label: 'Retained private checkpoint roll' },
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: new Date(startedAt + ordinal).toISOString(),
      evidence: {
        terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
        modifier: 0,
        mode: 'NORMAL',
        subtotal: 10,
        transform: { kind: 'NONE' },
        total: 10
      }
    })
  const existing = makeRoll(19)
  const seed = Array.from({ length: 19 }, (_, index) => ({
    record: makeRoll(index),
    gmCampaignRoll: { campaignId: foreign.id, creature: null, revealedAt: null, noticedAt: null }
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
      gmCampaignRoll: { campaignId: base.campaign.id, creature: null, revealedAt, noticedAt: null }
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
  const input = frame(authority, { changes: [run.change], history: [], retainedRolls: incoming })
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
    gmCampaignRoll: { campaignId: base.campaign.id, creature: null, revealedAt, noticedAt: null }
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
          record: { ...first, ruleset: { ...first.ruleset, systemId: crypto.randomUUID() } }
        }
      ],
      'another owner, Campaign or System'
    ],
    [
      [
        staged,
        {
          ...incoming[0],
          gmCampaignRoll: { ...incoming[0].gmCampaignRoll, campaignId: foreign.id }
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
