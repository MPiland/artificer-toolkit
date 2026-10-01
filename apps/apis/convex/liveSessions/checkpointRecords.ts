import type { IndexNames, IndexRange, WithoutSystemFields } from 'convex/server'
import {
  liveSessionCheckpointKeyFields,
  type LiveSessionCheckpointRecords,
  type LiveSessionCheckpointRecordChange,
  type LiveSessionCheckpointTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { encounterStoreIndexes } from '@artificer-toolkit/schema/projections/encounterStore'
import {
  encounterRunActorStateSchema,
  encounterActorProjectionFactsSchema,
  encounterSourceProjectionFactsSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  canonicalJsonRecordSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import {
  decodeCheckpointRecord,
  encodeCheckpointRecord
} from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { changedFields, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  readCharacterEffect,
  readEncounterEffect,
  readMaintainedState
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { applyJsonDelta } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { DataModel, Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { createReceiptLedger } from '../lib/receiptLedgers'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { applyCheckpointScenes } from './checkpointScenes'
import { applyCheckpointPrivateRolls } from './checkpointPrivateRolls'
import { reconcileCharacterHolds } from './characterHolds'
import {
  campaignStoredConversationSchema,
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema,
  createCampaignEntryHeader
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'

interface CheckpointIndexRange extends IndexRange {
  eq(field: string, value: string | number): CheckpointIndexRange
}

/** Shared key fields must name a complete existing index; a checkpoint never scans a table. */
async function readCheckpointRecord<Table extends LiveSessionCheckpointTable>(
  ctx: MutationCtx,
  table: Table,
  key: (string | number)[]
): Promise<Doc<Table> | null> {
  const fields = liveSessionCheckpointKeyFields[table]
  const indexes: Record<string, readonly string[]> = encounterStoreIndexes[table]
  const index = Object.entries(indexes).find(
    ([, candidate]) =>
      candidate.length === fields.length && candidate.every((field, i) => field === fields[i])
  )?.[0]
  if (!index || key.length !== fields.length)
    throw new Error('Checkpoint record index is unavailable.')
  return ctx.db
    .query(table)
    .withIndex(index as IndexNames<DataModel[Table]>, (query) => {
      // The shared contract validated this exact scalar key and the index's complete field order.
      let range = query as unknown as CheckpointIndexRange
      for (let i = 0; i < fields.length; i++) range = range.eq(fields[i]!, key[i]!)
      return range
    })
    .unique()
}

/** Scope and delta checks precede writes; final domain checks share their rollback boundary. */
export async function applyCheckpointRecords(
  ctx: MutationCtx,
  frame: { campaignId: string; epoch: string; checkpointId: string },
  records: LiveSessionCheckpointRecords
) {
  const changes = new Map<string, LiveSessionCheckpointRecordChange>()
  const currentRows = new Map<string, Doc<LiveSessionCheckpointTable> | null>()
  const nextRows = new Map<string, Record<string, JsonValue> | null>()
  for (const change of records.changes) {
    const identity = `${change.table}:${canonicalizeJson(change.key)}`
    if (changes.has(identity)) throw new Error('Checkpoint record identity is duplicated.')
    changes.set(identity, change)
    const row = await readCheckpointRecord(ctx, change.table, change.key)
    currentRows.set(identity, row)
    const fields = row ? (({ _id, _creationTime, ...value }) => value)(row) : null
    const current = fields ? decodeCheckpointRecord(change.table, fields) : null
    if ((current ? checksumCanonicalJson(current) : null) !== change.previousChecksum)
      throw new Error('Checkpoint record changed before publication.')
    const next = change.delta
      ? canonicalJsonRecordSchema.parse(applyJsonDelta(current, change.delta))
      : null
    if ((next ? checksumCanonicalJson(next) : null) !== change.nextChecksum)
      throw new Error('Checkpoint record delta checksum does not match.')
    if (
      next &&
      liveSessionCheckpointKeyFields[change.table].some((field, i) => next[field] !== change.key[i])
    )
      throw new Error('Checkpoint record identity cannot change.')
    if (current && next) {
      for (const field of ['campaignId', 'encounterId', 'characterId', 'userId'])
        if (current[field] !== next[field])
          throw new Error('Checkpoint record ownership cannot change.')
    }
    if (change.table === 'characterPlayStates') {
      if (!row || !next || !('streamVersion' in row))
        throw new Error('Checkpoint cannot create or delete Character play state.')
      if (Object.hasOwn(next, 'streamVersion'))
        throw new Error('Checkpoint cannot supply the Convex play clock.')
      if (checksumCanonicalJson(next.state) !== next.checksum)
        throw new Error('Checkpoint Character play checksum does not match.')
      next.streamVersion = row.streamVersion + 1
    }
    // Encoding validates the complete stored shape, even though the eventual write is a patch.
    if (next) encodeCheckpointRecord(change.table, next)
    nextRows.set(identity, next)
  }

  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', frame.campaignId))
    .unique()
  if (!campaign) throw new Error('Campaign not found.')
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', frame.campaignId))
    .collect()
  const assigned = new Map(assignments.map((row) => [row.characterId, row]))
  const activeMembers = new Set(
    (
      await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_status', (q) =>
          q.eq('campaignId', frame.campaignId).eq('status', 'ACTIVE')
        )
        .collect()
    ).map((row) => row.userId)
  )
  const checkedEncounters = new Set<string>()
  const checkedCharacters = new Map<string, string>()
  const requireEncounter = async (id: string) => {
    if (checkedEncounters.has(id)) return
    const next = nextRows.get(`encounterRuns:${canonicalizeJson([id])}`)
    const run =
      next ??
      (await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique())
    if (!run || run.campaignId !== campaign.id || run.gameSystemId !== campaign.gameSystemId)
      throw new Error('Checkpoint Encounter belongs to another Campaign or System.')
    checkedEncounters.add(id)
  }
  const requireCharacter = async (id: string, owner?: string) => {
    let userId = checkedCharacters.get(id)
    if (!userId) {
      const assignment = assigned.get(id)
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (
        !assignment ||
        !character ||
        character.userId !== assignment.userId ||
        character.systemId !== campaign.gameSystemId
      )
        throw new Error('Checkpoint Character is not held by this Campaign.')
      userId = character.userId
      checkedCharacters.set(id, userId)
    }
    if (owner && owner !== userId) throw new Error('Checkpoint Character owner does not match.')
  }
  const readConversationRecord = async (
    table:
      | 'campaignConversations'
      | 'campaignConversationEntries'
      | 'campaignConversationEntryPayloads',
    id: string
  ) => {
    const identity = `${table}:${canonicalizeJson([id])}`
    if (nextRows.has(identity)) return nextRows.get(identity) ?? null
    const row = await readCheckpointRecord(ctx, table, [id])
    if (!row) return null
    const { _id, _creationTime, ...fields } = row
    return decodeCheckpointRecord(table, fields)
  }
  const requireConversation = async (id: string) => {
    const record = await readConversationRecord('campaignConversations', id)
    if (!record) throw new Error('Checkpoint conversation is missing.')
    const conversation = campaignStoredConversationSchema.parse(record)
    if (conversation.campaignId !== frame.campaignId)
      throw new Error('Checkpoint conversation belongs to another Campaign.')
    return conversation
  }
  const requireConversationEntry = async (id: string) => {
    const record = await readConversationRecord('campaignConversationEntries', id)
    if (!record) throw new Error('Checkpoint conversation entry is missing.')
    const header = campaignStoredEntryHeaderSchema.parse(record)
    if (header.campaignId !== frame.campaignId)
      throw new Error('Checkpoint conversation entry belongs to another Campaign.')
    await requireConversation(header.conversationId)
    return header
  }
  const validateConversationPayload = async (id: string) => {
    const header = await requireConversationEntry(id)
    const record = await readConversationRecord('campaignConversationEntryPayloads', id)
    if (!record) throw new Error('Checkpoint conversation payload is missing.')
    const payload = campaignStoredEntryPayloadSchema.parse(record)
    const identity = campaignStoredEntryIdentitySchema.parse({
      id: header.id,
      campaignId: header.campaignId,
      conversationId: header.conversationId,
      authorUserId: header.authorUserId,
      createdAt: header.createdAt,
      clientNonce: header.clientNonce
    })
    if (
      checksumCanonicalJson(header) !==
      checksumCanonicalJson(createCampaignEntryHeader(identity, payload))
    )
      throw new Error('Checkpoint conversation nonce evidence does not match its payload.')
  }
  const requireScope = async (table: string, value: Record<string, unknown>) => {
    if (typeof value.campaignId === 'string' && value.campaignId !== frame.campaignId)
      throw new Error('Checkpoint record belongs to another Campaign.')
    if (table === 'encounterRuns') await requireEncounter(String(value.id))
    else if (typeof value.encounterId === 'string') await requireEncounter(value.encounterId)
    if (table === 'campaignConversationMembers' || table === 'campaignConversationEntries')
      await requireConversation(String(value.conversationId))
    if (table === 'campaignConversationEntryPayloads')
      await requireConversationEntry(String(value.entryId))
    // A message-time Character snapshot may survive assignment departure.
    if (table !== 'campaignConversationEntryPayloads' && typeof value.characterId === 'string')
      await requireCharacter(
        value.characterId,
        typeof value.userId === 'string' ? value.userId : undefined
      )
    if (typeof value.sourceEncounterId === 'string') await requireEncounter(value.sourceEncounterId)
    if (typeof value.sceneId === 'string') {
      const scene = await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', value.sceneId as string))
        .unique()
      if (!scene || scene.campaignId !== frame.campaignId)
        throw new Error('Checkpoint Scene belongs to another Campaign.')
    }
  }
  const newConversationKeys = new Set<string>()
  const newEntryNonceKeys = new Set<string>()
  for (const [identity, change] of changes) {
    const row = currentRows.get(identity)
    const next = nextRows.get(identity)
    if (row) await requireScope(change.table, row)
    if (next) await requireScope(change.table, next)
    if (!row && next && change.table === 'campaignConversations') {
      const conversation = campaignStoredConversationSchema.parse(next)
      const key = canonicalizeJson([
        conversation.campaignId,
        conversation.kind,
        conversation.participantUserIds
      ])
      const prior = await ctx.db
        .query('campaignConversations')
        .withIndex('by_campaignId_kind_participants', (q) =>
          q
            .eq('campaignId', conversation.campaignId)
            .eq('kind', conversation.kind)
            .eq('participantUserIds', conversation.participantUserIds)
        )
        .unique()
      if (prior || newConversationKeys.has(key))
        throw new Error('Checkpoint conversation identity already exists.')
      newConversationKeys.add(key)
    }
    if (!row && next && change.table === 'campaignConversationEntries') {
      const header = campaignStoredEntryHeaderSchema.parse(next)
      const key = canonicalizeJson([header.campaignId, header.authorUserId, header.clientNonce])
      const prior = await ctx.db
        .query('campaignConversationEntries')
        .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
          q
            .eq('campaignId', header.campaignId)
            .eq('authorUserId', header.authorUserId)
            .eq('clientNonce', header.clientNonce)
        )
        .unique()
      if (prior || newEntryNonceKeys.has(key))
        throw new Error('Checkpoint conversation nonce already exists.')
      newEntryNonceKeys.add(key)
    }
    if (
      row &&
      !next &&
      [
        'campaignConversations',
        'campaignConversationEntries',
        'campaignConversationEntryPayloads'
      ].includes(change.table)
    )
      throw new Error('Checkpoint cannot delete retained conversation history.')
    if (
      row &&
      next &&
      (change.table === 'campaignConversations' || change.table === 'campaignConversationEntries')
    ) {
      const { _id, _creationTime, ...fields } = row
      if (
        checksumCanonicalJson(fields) !==
        checksumCanonicalJson(encodeCheckpointRecord(change.table, next))
      )
        throw new Error('Checkpoint conversation identity and nonce headers are immutable.')
    }
    if (row && next && change.table === 'campaignConversationEntryPayloads') {
      const { _id, _creationTime, ...fields } = row
      const previous = campaignStoredEntryPayloadSchema.parse(fields)
      if (previous.kind !== next.kind)
        throw new Error('Checkpoint conversation payload kind cannot change.')
      if (
        previous.kind === 'CHAT' &&
        (['mode', 'authorUsername', 'characterLabel', 'revealedByGm', 'consumedAt'] as const).some(
          (field) => previous[field] !== next[field]
        )
      )
        throw new Error('Checkpoint CHAT message-time snapshots are immutable.')
    }
    if (next && change.table === 'campaignConversationEntries')
      await validateConversationPayload(String(next.id))
    if (next && change.table === 'campaignConversationEntryPayloads')
      await validateConversationPayload(String(next.entryId))
  }
  const ledgers = new Map<string, LiveSessionCheckpointRecords['history']>()
  for (const entry of records.history) {
    await requireScope(entry.table, entry.value)
    const scope =
      entry.table === 'characterCommandReceipts'
        ? `CHARACTER:${String(entry.value.characterId)}`
        : `CAMPAIGN:${frame.campaignId}`
    const entries = ledgers.get(scope) ?? []
    entries.push(entry)
    ledgers.set(scope, entries)
  }
  for (const [identity, change] of changes) {
    const row = currentRows.get(identity)
    const next = nextRows.get(identity)
    if (!next) {
      if (row) await ctx.db.delete(row._id)
      continue
    }
    const encoded = encodeCheckpointRecord(change.table, next)
    // Shared shape validation above preserves the selected native family's write contract.
    const stored = encoded as WithoutSystemFields<Doc<LiveSessionCheckpointTable>>
    if (row) {
      const { _id, _creationTime, ...before } = row
      const removed = Object.fromEntries(
        Object.keys(before)
          .filter((field) => !Object.hasOwn(stored, field))
          .map((field) => [field, undefined])
      )
      await ctx.db.patch(_id, { ...changedFields(before, stored), ...removed })
    } else await ctx.db.insert(change.table, stored)
  }
  const pendingOccurrences = new Set<string>()
  for (const change of records.changes) {
    const previous = currentRows.get(`${change.table}:${canonicalizeJson(change.key)}`)
    if (change.table === 'encounterPendingSnapshotParts' && previous)
      pendingOccurrences.add((previous as Doc<'encounterPendingSnapshotParts'>).occurrenceId)
    const row = await readCheckpointRecord(ctx, change.table, change.key)
    if (!row) continue
    // The table-selected native query and stored schema preserve these document correlations.
    switch (change.table) {
      case 'encounterRuns':
        readRunState(row as Doc<'encounterRuns'>)
        break
      case 'encounterRunActors': {
        const actor = row as Doc<'encounterRunActors'>
        const state = encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
        if (
          state.id !== actor.id ||
          state.encounterId !== actor.encounterId ||
          checksumCanonicalJson(state) !== actor.stateChecksum
        )
          throw new Error('Checkpoint actor state checksum or identity does not match.')
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', state.encounterId))
          .unique()
        // The room reconciles departures itself (D74); an open Run never names a departed
        // controller or an unfrozen Character the Campaign no longer assigns.
        if (
          run &&
          run.status !== 'COMPLETED' &&
          ((state.kind === 'CHARACTER' && !state.frozenState && !assigned.has(state.sourceId)) ||
            state.controllerUserIds.some((id) => !activeMembers.has(id)))
        )
          throw new Error('Checkpoint actor names a departed controller or unassigned Character.')
        break
      }
      case 'encounterActorProjectionFacts': {
        const actor = row as Doc<'encounterActorProjectionFacts'>
        const facts = encounterActorProjectionFactsSchema.parse(JSON.parse(actor.factsJson))
        if (
          facts.id !== actor.id ||
          facts.encounterId !== actor.encounterId ||
          (facts.kind === 'CHARACTER' ? null : facts.sourceFactsChecksum) !==
            actor.sourceFactsChecksum
        )
          throw new Error('Checkpoint actor projection facts do not match.')
        break
      }
      case 'encounterSourceProjectionFacts': {
        const source = row as Doc<'encounterSourceProjectionFacts'>
        const facts = encounterSourceProjectionFactsSchema.parse(JSON.parse(source.factsJson))
        if (checksumCanonicalJson(facts) !== source.checksum)
          throw new Error('Checkpoint source facts checksum does not match.')
        break
      }
      case 'characterActiveRuleEffects':
        readCharacterEffect(row as Doc<'characterActiveRuleEffects'>)
        break
      case 'encounterActiveRuleEffects':
        readEncounterEffect(row as Doc<'encounterActiveRuleEffects'>)
        break
      case 'encounterMaintainedEffectStates':
        readMaintainedState(row as Doc<'encounterMaintainedEffectStates'>)
        break
      case 'encounterSpatialRuleEffects':
        readSpatialEffect(row as Doc<'encounterSpatialRuleEffects'>)
        break
      case 'encounterRuleOccurrences':
        pendingOccurrences.add((row as Doc<'encounterRuleOccurrences'>).id)
        break
      case 'encounterPendingSnapshotParts':
        pendingOccurrences.add((row as Doc<'encounterPendingSnapshotParts'>).occurrenceId)
        break
    }
  }
  const store = { db: createConvexEncounterStoreReader(ctx) }
  for (const id of pendingOccurrences) {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    if (!occurrence) {
      const deletion = changes.get(`encounterRuleOccurrences:${canonicalizeJson([id])}`)
      if (deletion?.nextChecksum === null) continue
      throw new Error('Checkpoint pending snapshot occurrence is missing.')
    }
    await readPendingSnapshot(store, occurrence)
  }
  await applyCheckpointScenes(ctx, frame, records.scenes)
  for (const [scope, entries] of ledgers) {
    const separator = scope.indexOf(':')
    await createReceiptLedger(
      ctx,
      {
        id: crypto.randomUUID(),
        scope: scope.startsWith('CHARACTER:') ? 'CHARACTER' : 'CAMPAIGN',
        scopeId: scope.slice(separator + 1),
        epoch: frame.epoch,
        checkpointId: frame.checkpointId,
        createdAt: new Date().toISOString()
      },
      entries
    )
  }
  await applyCheckpointPrivateRolls(ctx, frame, records.retainedRolls)
  const heldRuns = new Set<string>()
  for (const change of records.changes)
    if (change.table === 'encounterRuns' || change.table === 'encounterRunActors')
      heldRuns.add(String(change.key[0]))
  if (heldRuns.size) await reconcileCharacterHolds(ctx, frame.campaignId, frame.epoch, heldRuns)
}
