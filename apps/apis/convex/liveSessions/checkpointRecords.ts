import type { IndexNames, IndexRange, WithoutSystemFields } from 'convex/server'
import {
  liveSessionCheckpointKeyFields,
  type LiveSessionCheckpointRecords,
  type LiveSessionCheckpointRecordChange,
  type LiveSessionCheckpointTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { encounterStoreIndexes } from '@artificer-toolkit/schema/projections/encounterStore'
import { liveRoomActorSourceSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { encounterSourceProjectionFactsSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  canonicalJsonRecordSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import {
  decodeCheckpointRecord,
  encodeCheckpointRecord
} from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { changedFields, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { removeActorLoot } from '../loot/ownerRows'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readStoredActorSnapshot } from '@artificer-toolkit/encounter-persistence/actorSnapshots'
import { readStoredSpellPin } from '@artificer-toolkit/encounter-persistence/spellPins'
import {
  readCharacterEffect,
  readEncounterEffect,
  readMaintainedState
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { applyJsonDelta } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { LiveSessionCheckpointAdoption } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionRoomAuthorizationRevisions } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { DataModel, Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { createReceiptLedger } from '../lib/receiptLedgers'
import { removeFinishedRunRows } from '../encounters/campaignDeletion'
import { carryOverRunGrants, endOutsideCarriedGrants } from '../encounters/runGrantCarryOver'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readSceneVisionRevision } from '../scenes/visionFreshness'
import type { CheckpointIoMeter } from './checkpointIo'
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
      let range = query as CheckpointIndexRange
      for (let i = 0; i < fields.length; i++) range = range.eq(fields[i]!, key[i]!)
      return range
    })
    .unique()
}

/**
 * What a record contributes to Character holds (D74, D81): a Run's status, and whether a Character
 * actor is still unfrozen for its Character. Holds reconcile only when a change alters this.
 */
function holdInput(
  table: LiveSessionCheckpointTable,
  record: Record<string, JsonValue> | null
): string | null {
  if (!record) return null
  if (table === 'encounterRuns') return String(record.status)
  if (table !== 'encounterRunActors') return null
  const state = liveRoomActorSourceSchema.parse(record.stateJson)
  return state.kind === 'CHARACTER'
    ? `${state.sourceId}:${state.frozenState ? 'frozen' : 'live'}`
    : null
}

/** The scopes a checkpoint's own writes can bump and a room holds: PLAY and the delta Characters. */
async function readOwnRevisions(
  ctx: MutationCtx,
  campaignId: string,
  characterIds: ReadonlySet<string>
) {
  return {
    play: await readSceneVisionRevision(ctx, 'PLAY', campaignId),
    characters: await Promise.all(
      [...characterIds].map(async (characterId) => ({
        characterId,
        revision: await readSceneVisionRevision(ctx, 'CHARACTER', characterId)
      }))
    )
  }
}

/**
 * Scope and delta checks precede writes; final domain checks share their rollback boundary. Every
 * read is keyed by the delta, never by the Campaign's size (ADR 0035 Amendment 18). Returns the
 * revisions the room may adopt as its own (see `liveSessionCheckpointAdoptionSchema`).
 */
export async function applyCheckpointRecords(
  ctx: MutationCtx,
  frame: { campaignId: string; epoch: string; checkpointId: string },
  records: LiveSessionCheckpointRecords,
  known: LiveSessionRoomAuthorizationRevisions | null,
  io: CheckpointIoMeter
): Promise<LiveSessionCheckpointAdoption> {
  const heldRuns = new Set<string>()
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
    if (change.table === 'encounterReplayIndex' && current && next)
      throw new Error('Checkpoint replay-index rows are insert-only.')
    if (current && next) {
      for (const field of ['campaignId', 'encounterId', 'characterId', 'userId'])
        if (current[field] !== next[field])
          throw new Error('Checkpoint record ownership cannot change.')
    }
    if (change.table === 'characterPlayStates') {
      if (!row || !next || !('streamVersion' in row))
        throw new Error('Checkpoint cannot create or delete Character play state.')
      // The room owns the play clock while it holds the Character; it may only move forward.
      if (typeof next.streamVersion !== 'number' || next.streamVersion <= row.streamVersion)
        throw new Error('Checkpoint Character play version must advance.')
      if (checksumCanonicalJson(next.state) !== next.checksum)
        throw new Error('Checkpoint Character play checksum does not match.')
    }
    // Encoding validates the complete stored shape, even though the eventual write is a patch.
    if (next) encodeCheckpointRecord(change.table, next)
    nextRows.set(identity, next)
    if (holdInput(change.table, current) !== holdInput(change.table, next))
      heldRuns.add(String(change.key[0]))
  }
  await io.mark('records')
  const knownCharacterIds = new Set(known?.characters.map(({ characterId }) => characterId))
  const deltaCharacterIds = new Set<string>()
  for (const [identity, change] of changes) {
    if (change.table !== 'characterPlayStates' && change.table !== 'characterActiveRuleEffects')
      continue
    const scoped = nextRows.get(identity) ?? currentRows.get(identity)
    const characterId = scoped && 'characterId' in scoped ? scoped.characterId : undefined
    if (typeof characterId === 'string' && knownCharacterIds.has(characterId))
      deltaCharacterIds.add(characterId)
  }
  // Read before any write: a scope the room already held at this revision may adopt our own bump.
  const before = known ? await readOwnRevisions(ctx, frame.campaignId, deltaCharacterIds) : null
  await io.mark('remainder')

  let campaign: Doc<'campaigns'> | null = null
  const readCampaign = async () => {
    campaign ??= await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', frame.campaignId))
      .unique()
    if (!campaign) throw new Error('Campaign not found.')
    return campaign
  }
  const assignments = new Map<string, Doc<'campaignCharacterAssignments'> | null>()
  const readAssignment = async (characterId: string) => {
    if (!assignments.has(characterId)) {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
      assignments.set(characterId, assignment?.campaignId === frame.campaignId ? assignment : null)
    }
    return assignments.get(characterId) ?? null
  }
  const activeMembers = new Map<string, boolean>()
  const isActiveMember = async (userId: string) => {
    if (!activeMembers.has(userId)) {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', frame.campaignId).eq('userId', userId)
        )
        .unique()
      activeMembers.set(userId, membership?.status === 'ACTIVE')
    }
    return activeMembers.get(userId) === true
  }
  const checkedEncounters = new Map<string, { status: JsonValue }>()
  const requireEncounter = async (id: string) => {
    const checked = checkedEncounters.get(id)
    if (checked) return checked
    const next = nextRows.get(`encounterRuns:${canonicalizeJson([id])}`)
    const run =
      next ??
      (await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique())
    if (
      !run ||
      run.campaignId !== frame.campaignId ||
      run.gameSystemId !== (await readCampaign()).gameSystemId
    )
      throw new Error('Checkpoint Encounter belongs to another Campaign or System.')
    const encounter = { status: run.status }
    checkedEncounters.set(id, encounter)
    return encounter
  }
  // Assignment fixes a Character's owner and System, and neither changes afterwards, so no
  // Character document is read. A held Character's rows keep the owner they were created with.
  const heldCharacters = new Set<string>()
  const requireCharacter = async (id: string, owner?: string) => {
    const assignment = await readAssignment(id)
    // A departed Character the room still holds keeps its play until the hold drops (D81).
    if (!assignment && !heldCharacters.has(id)) {
      const held = (
        await ctx.db
          .query('liveCharacterHolds')
          .withIndex('by_characterId', (q) => q.eq('characterId', id))
          .collect()
      ).some((hold) => hold.campaignId === frame.campaignId && hold.epoch === frame.epoch)
      if (!held) throw new Error('Checkpoint Character is not held by this Campaign.')
      heldCharacters.add(id)
    }
    if (owner && assignment && owner !== assignment.userId)
      throw new Error('Checkpoint Character owner does not match.')
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
    if (row && 'campaignId' in row && row.campaignId !== frame.campaignId)
      throw new Error('Checkpoint record belongs to another Campaign.')
    // Ownership is immutable, so the changed row's relations are its current row's.
    const scoped = next ?? row
    if (scoped) await requireScope(change.table, scoped)
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
    const scope = String(entry.value.characterId)
    const entries = ledgers.get(scope) ?? []
    entries.push(entry)
    ledgers.set(scope, entries)
  }
  await io.mark('scopes')
  // The stored documents as written, validated below without rereading them.
  const written = new Map<string, Doc<LiveSessionCheckpointTable>>()
  for (const [identity, change] of changes) {
    const row = currentRows.get(identity)
    const next = nextRows.get(identity)
    if (!next) {
      if (row) {
        await ctx.db.delete(row._id)
        if (change.table === 'encounterRunActors') {
          const actor = row as Doc<'encounterRunActors'>
          await removeActorLoot(ctx, actor.encounterId, actor.id)
        }
      }
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
      written.set(identity, { ...stored, _id, _creationTime } as typeof row)
    } else {
      const _id = await ctx.db.insert(change.table, stored)
      // Validators ignore system fields; the insert's creation time is not read back.
      written.set(identity, {
        ...stored,
        _id,
        _creationTime: Date.now()
      } as Doc<typeof change.table>)
    }
  }
  await io.mark('records')
  const pendingOccurrences = new Set<string>()
  const completedRuns: string[] = []
  const newConcentrationCasters: { encounterId: string; casterCharacterIds: string[] }[] = []
  for (const [identity, change] of changes) {
    const previous = currentRows.get(identity)
    if (change.table === 'encounterPendingSnapshotParts' && previous)
      pendingOccurrences.add((previous as Doc<'encounterPendingSnapshotParts'>).occurrenceId)
    const row = written.get(identity)
    if (!row) continue
    // The table-selected native query and stored schema preserve these document correlations.
    switch (change.table) {
      case 'encounterRuns': {
        const run = row as Doc<'encounterRuns'>
        readRunState(run)
        const known = new Set(
          (previous as Doc<'encounterRuns'> | null | undefined)?.concentrationCasterCharacterIds
        )
        const casterCharacterIds = run.concentrationCasterCharacterIds.filter(
          (characterId) => !known.has(characterId)
        )
        if (casterCharacterIds.length)
          newConcentrationCasters.push({ encounterId: run.id, casterCharacterIds })
        // A Campaign has one active Encounter, wherever it started.
        if (
          run.status === 'ACTIVE' &&
          (previous as Doc<'encounterRuns'> | null | undefined)?.status !== 'ACTIVE' &&
          (
            await ctx.db
              .query('encounterRuns')
              .withIndex('by_campaignId_status', (q) =>
                q.eq('campaignId', run.campaignId).eq('status', 'ACTIVE')
              )
              .take(2)
          ).length > 1
        )
          throw new Error('Checkpoint starts a second active Encounter in the Campaign.')
        // A completed Run keeps only its actors and their source facts (ADR 0035 Amendment 30).
        if (
          run.status === 'COMPLETED' &&
          (previous as Doc<'encounterRuns'> | null | undefined)?.status !== 'COMPLETED'
        )
          completedRuns.push(run.id)
        break
      }
      case 'encounterRunActors': {
        const actor = row as Doc<'encounterRunActors'>
        const state = readStoredRunActor(actor)
        // The room reconciles departures itself (D74); an open Run never names a departed
        // controller or an unfrozen Character the Campaign no longer assigns.
        if ((await requireEncounter(state.encounterId)).status !== 'COMPLETED') {
          let departed =
            state.kind === 'CHARACTER' &&
            !state.frozenState &&
            !(await readAssignment(state.sourceId))
          for (const id of state.controllerUserIds) departed ||= !(await isActiveMember(id))
          if (departed)
            throw new Error('Checkpoint actor names a departed controller or unassigned Character.')
        }
        break
      }
      case 'encounterActorSnapshots':
        readStoredActorSnapshot(row as Doc<'encounterActorSnapshots'>)
        break
      case 'encounterSourceProjectionFacts': {
        const source = row as Doc<'encounterSourceProjectionFacts'>
        const facts = encounterSourceProjectionFactsSchema.parse(JSON.parse(source.factsJson))
        if (checksumCanonicalJson(facts) !== source.checksum)
          throw new Error('Checkpoint source facts checksum does not match.')
        break
      }
      case 'encounterSpellPins':
        readStoredSpellPin(row as Doc<'encounterSpellPins'>)
        break
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
    const identity = `encounterRuleOccurrences:${canonicalizeJson([id])}`
    // A written occurrence is not read back; its parts are, because earlier parts are not in the delta.
    const occurrence =
      (written.get(identity) as Doc<'encounterRuleOccurrences'> | undefined) ??
      (await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique())
    if (!occurrence) {
      const deletion = changes.get(identity)
      if (deletion?.nextChecksum === null) continue
      throw new Error('Checkpoint pending snapshot occurrence is missing.')
    }
    await readPendingSnapshot(store, occurrence)
  }
  await io.mark('records')
  const carriedOver = new Set<string>()
  for (const { encounterId, casterCharacterIds } of newConcentrationCasters)
    await endOutsideCarriedGrants(ctx, frame.campaignId, encounterId, casterCharacterIds)
  for (const encounterId of completedRuns) {
    await removeFinishedRunRows(ctx, encounterId)
    for (const characterId of await carryOverRunGrants(ctx, frame.campaignId, encounterId))
      carriedOver.add(characterId)
  }
  await applyCheckpointScenes(ctx, frame, records.scenes)
  await io.mark('scenes')
  for (const [characterId, entries] of ledgers) {
    await createReceiptLedger(
      ctx,
      {
        id: crypto.randomUUID(),
        scope: 'CHARACTER',
        scopeId: characterId,
        epoch: frame.epoch,
        checkpointId: frame.checkpointId,
        createdAt: new Date().toISOString()
      },
      entries
    )
  }
  await io.mark('history')
  await applyCheckpointPrivateRolls(ctx, frame, records.retainedRolls)
  await io.mark('privateRolls')
  if (heldRuns.size) await reconcileCharacterHolds(ctx, frame.campaignId, frame.epoch, heldRuns)
  await io.mark('holds')
  if (!known || !before) return { characters: [] }
  const after = await readOwnRevisions(ctx, frame.campaignId, deltaCharacterIds)
  await io.mark('remainder')
  const knownCharacters = new Map(
    known.characters.map((entry) => [entry.characterId, entry.revision])
  )
  const beforeCharacters = new Map(
    before.characters.map((entry) => [entry.characterId, entry.revision])
  )
  return {
    ...(after.play !== null && before.play === known.play && after.play !== before.play
      ? { play: after.play }
      : {}),
    // Carried-over grants are Convex's own write, so the room reloads those Characters.
    characters: after.characters.filter(
      ({ characterId, revision }) =>
        !carriedOver.has(characterId) &&
        revision !== beforeCharacters.get(characterId) &&
        knownCharacters.get(characterId) === beforeCharacters.get(characterId)
    )
  }
}
