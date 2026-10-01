import { v, ConvexError } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  developmentCheckpointScopeSchema,
  developmentCheckpointInspectionSchema,
  developmentCheckpointRollbackInputSchema,
  developmentCheckpointPreparationInputSchema,
  developmentCheckpointDiscardUploadInputSchema,
  DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER,
  type DevelopmentCheckpointScope
} from '@artificer-toolkit/schema/api/developmentCheckpoint'
import { liveSessionCheckpointInputSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import {
  liveSessionCheckpointHistoryKeyFields,
  type LiveSessionCheckpointHistoryTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { receiptLedgerMetadataSchema } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import { decodeCheckpointRecord } from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { diffJson } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encodeBase64 } from '@artificer-toolkit/shared/base64'
import type { QueryCtx } from '../_generated/server'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { untrackedInternalMutation, withSceneVisionTracking } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import {
  claimCampaignLiveAuthority,
  commitCampaignLiveAuthorityActivation,
  presentCampaignLiveAuthority
} from './authority'
import { readCampaignLiveAuthority } from './authorityGuard'
import { publishCheckpoint } from './checkpoint'
import { commitStagedCheckpoint } from './checkpointStaging'

export async function readCheckpointFixture(ctx: QueryCtx, scope: DevelopmentCheckpointScope) {
  await requireFixtureAccount(ctx, scope.ownerUserId)
  await requireFixtureAccount(ctx, scope.playerUserId)
  if (scope.ownerUserId === scope.playerUserId)
    throw new Error('Fixture owner and player must differ.')
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', scope.campaignId))
    .unique()
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', scope.encounterId))
    .unique()
  const character = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', scope.characterId))
    .unique()
  const play = await ctx.db
    .query('characterPlayStates')
    .withIndex('by_characterId', (q) => q.eq('characterId', scope.characterId))
    .unique()
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', scope.campaignId))
    .take(2)
  const members = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', scope.campaignId))
    .take(3)
  if (
    !campaign ||
    campaign.name !== 'Encounter execution fixture' ||
    campaign.ownerUserId !== scope.ownerUserId ||
    !run ||
    run.campaignId !== campaign.id ||
    run.gameSystemId !== campaign.gameSystemId ||
    !character ||
    character.userId !== scope.playerUserId ||
    character.systemId !== campaign.gameSystemId ||
    !play ||
    play.userId !== scope.playerUserId ||
    assignments.length !== 1 ||
    assignments[0]?.characterId !== character.id ||
    assignments[0]?.userId !== scope.playerUserId ||
    members.length !== 2 ||
    members.some(
      (member) => member.userId !== scope.ownerUserId && member.userId !== scope.playerUserId
    )
  )
    throw new Error(
      'Checkpoint proof requires the exact reserved fixture Campaign, Run and assigned Character.'
    )
  return { campaign, run, play }
}

function history(table: LiveSessionCheckpointHistoryTable, fields: Record<string, unknown>) {
  const value = decodeCheckpointRecord(table, fields)
  return {
    table,
    key: liveSessionCheckpointHistoryKeyFields[table].map((field) => {
      const identity = value[field]
      if (typeof identity !== 'string' && typeof identity !== 'number')
        throw new Error('Fixture history identity is incomplete.')
      return identity
    }),
    value,
    checksum: checksumCanonicalJson(value)
  }
}

/** No existing room authority may be adopted; the staged fixture stays within normal note limits. */
export const prepare = untrackedInternalMutation({
  args: v.any(),
  returns: v.any(),
  handler: async (rawCtx, args) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const { staged, ...scope } = developmentCheckpointPreparationInputSchema.parse(args)
    const { run, play } = await readCheckpointFixture(ctx, scope)
    if (await readCampaignLiveAuthority(ctx, scope.campaignId))
      throw new Error('Fixture Campaign already has live authority.')
    const { authority: claimed } = await claimCampaignLiveAuthority(ctx, {
      campaignId: scope.campaignId,
      userId: scope.ownerUserId,
      expiresAt: Date.now() + 60_000
    })
    const authority = await commitCampaignLiveAuthorityActivation(ctx, {
      campaignId: scope.campaignId,
      epoch: claimed.epoch,
      activationFingerprint: claimed.activationFingerprint,
      stateChecksum: checksumCanonicalJson({ fixture: scope, version: run.version })
    })
    const now = new Date().toISOString()
    const state = readRunState(run)
    const reminders = Array.from({ length: staged ? 64 : 2 }, (_, order) => ({
      id: crypto.randomUUID(),
      label: `Checkpoint native proof ${order}`,
      timing: 'ROUND_START' as const,
      round: null,
      actorId: null,
      public: false,
      notes: staged ? '🎲'.repeat(2000) : null,
      order
    }))
    const nextState = {
      ...state,
      version: state.version + reminders.length,
      reminders: [...state.reminders, ...reminders]
    }
    const { _id: _runId, _creationTime: _runTime, ...runFields } = run
    const { _id: _playId, _creationTime: _playTime, ...playFields } = play
    const beforeRun = decodeCheckpointRecord('encounterRuns', runFields)
    const afterRun = decodeCheckpointRecord('encounterRuns', {
      ...runFields,
      version: nextState.version,
      stateJson: canonicalizeJson(nextState),
      stateChecksum: checksumCanonicalJson(nextState),
      updatedAt: now
    })
    const nextPlay = { ...play.state, inspiration: !play.state.inspiration }
    const beforePlay = decodeCheckpointRecord('characterPlayStates', playFields)
    const afterPlay = decodeCheckpointRecord('characterPlayStates', {
      ...playFields,
      state: nextPlay,
      checksum: checksumCanonicalJson(nextPlay),
      updatedAt: now
    })
    const entries = reminders.map((reminder, i) => {
      const commandId = crypto.randomUUID()
      const command = {
        type: 'UPSERT_REMINDER',
        encounterId: run.id,
        expectedVersion: run.version + i,
        commandId,
        reminder
      }
      const replay = { roll: null, occurrence: null }
      return history('encounterRunCommands', {
        id: crypto.randomUUID(),
        campaignId: scope.campaignId,
        encounterId: run.id,
        commandId,
        commandFingerprint: checksumCanonicalJson(command),
        actorUserId: scope.ownerUserId,
        createdAt: now,
        visibility: 'PRIVATE',
        commandType: 'UPSERT_REMINDER',
        version: run.version + i + 1,
        commandJson: canonicalizeJson(command),
        replayReceiptJson: canonicalizeJson(replay),
        replayReceiptChecksum: checksumCanonicalJson(replay)
      })
    })
    const event = characterHistoryEntryDtoSchema.parse({
      eventId: crypto.randomUUID(),
      occurredAt: now,
      actorId: scope.playerUserId,
      eventType: 'CHECKPOINT_PROOF',
      summary: 'Native checkpoint inspiration change'
    })
    entries.push(
      history('characterCommandReceipts', {
        id: event.eventId,
        characterId: scope.characterId,
        commandId: crypto.randomUUID(),
        actorId: scope.playerUserId,
        commandFingerprint: checksumCanonicalJson({ inspiration: nextPlay.inspiration }),
        occurredAt: now,
        historyJson: canonicalizeJson(event),
        historyChecksum: checksumCanonicalJson(event)
      })
    )
    const records = {
      changes: [
        {
          table: 'encounterRuns',
          key: [run.id],
          previousChecksum: checksumCanonicalJson(beforeRun),
          nextChecksum: checksumCanonicalJson(afterRun),
          delta: diffJson(beforeRun, afterRun)
        },
        {
          table: 'characterPlayStates',
          key: [play.characterId],
          previousChecksum: checksumCanonicalJson(beforePlay),
          nextChecksum: checksumCanonicalJson(afterPlay),
          delta: diffJson(beforePlay, afterPlay)
        }
      ],
      history: entries,
      scenes: []
    }
    return liveSessionCheckpointInputSchema.parse({
      campaignId: scope.campaignId,
      epoch: authority.epoch,
      checkpointId: crypto.randomUUID(),
      fromSequence: 0,
      fromChecksum: authority.persistedStateChecksum,
      sequence: reminders.length + 1,
      checksum: checksumCanonicalJson({ epoch: authority.epoch, records }),
      payloadChecksum: checksumCanonicalJson(records),
      records,
      knownAuthorization: null
    })
  }
})

/** Deliberately fails after real publication to prove the enclosing native transaction rolls back. */
export const rollback = untrackedInternalMutation({
  args: v.any(),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { scope, checkpoint, staged } = developmentCheckpointRollbackInputSchema.parse(args)
    await readCheckpointFixture(ctx, scope)
    if (checkpoint.campaignId !== scope.campaignId)
      throw new Error('Fixture checkpoint Campaign does not match.')
    if (staged) {
      const { records: _records, ...commit } = checkpoint
      await commitStagedCheckpoint(ctx, commit)
    } else await publishCheckpoint(ctx, checkpoint)
    throw new ConvexError(DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER)
  }
})

/** Failed proof cleanup may discard only the exact reserved fixture's uncommitted upload. */
export const discardUpload = untrackedInternalMutation({
  args: v.any(),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { scope, checkpointId } = developmentCheckpointDiscardUploadInputSchema.parse(args)
    await readCheckpointFixture(ctx, scope)
    const row = await ctx.db
      .query('liveSessionCheckpointUploads')
      .withIndex('by_checkpointId', (q) => q.eq('checkpointId', checkpointId))
      .unique()
    if (!row) return null
    if (row.campaignId !== scope.campaignId)
      throw new Error('Fixture upload belongs to another Campaign.')
    const parts = await ctx.db
      .query('liveSessionCheckpointUploadParts')
      .withIndex('by_checkpointId_index', (q) => q.eq('checkpointId', checkpointId))
      .take(19)
    if (parts.length > 18) throw new Error('Fixture upload exceeds its part bound.')
    for (const part of parts) await ctx.db.delete(part._id)
    await ctx.db.delete(row._id)
    return null
  }
})

/** Exact fixture digest includes state, clocks, headers, ledger metadata and outside-view revisions. */
export const inspect = internalQuery({
  args: zodToConvexFields(developmentCheckpointScopeSchema.shape),
  returns: zodToConvex(developmentCheckpointInspectionSchema),
  handler: async (ctx, args) => {
    const scope = developmentCheckpointScopeSchema.parse(args)
    const fixture = await readCheckpointFixture(ctx, scope)
    const [
      authority,
      commands,
      characterReceipts,
      campaignLedgers,
      characterLedgers,
      campaignRevision,
      playRevision,
      characterRevision,
      uploads
    ] = await Promise.all([
      readCampaignLiveAuthority(ctx, scope.campaignId),
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', scope.encounterId))
        .take(145),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_occurredAt_id', (q) => q.eq('characterId', scope.characterId))
        .take(20),
      ctx.db
        .query('receiptLedgers')
        .withIndex('by_scope_scopeId', (q) =>
          q.eq('scope', 'CAMPAIGN').eq('scopeId', scope.campaignId)
        )
        .take(20),
      ctx.db
        .query('receiptLedgers')
        .withIndex('by_scope_scopeId', (q) =>
          q.eq('scope', 'CHARACTER').eq('scopeId', scope.characterId)
        )
        .take(20),
      ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CAMPAIGN').eq('id', scope.campaignId))
        .unique(),
      ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'PLAY').eq('id', scope.campaignId))
        .unique(),
      ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', scope.characterId))
        .unique(),
      ctx.db
        .query('liveSessionCheckpointUploads')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', scope.campaignId))
        .take(2)
    ])
    if (
      commands.length >= 145 ||
      uploads.length > 1 ||
      [characterReceipts, campaignLedgers, characterLedgers].some((rows) => rows.length >= 20)
    )
      throw new Error('Checkpoint proof fixture exceeds its inspection bound.')
    const uploadParts = await Promise.all(
      uploads.map(async (upload) => {
        const rows = await ctx.db
          .query('liveSessionCheckpointUploadParts')
          .withIndex('by_checkpointId_index', (q) => q.eq('checkpointId', upload.checkpointId))
          .take(19)
        if (rows.length > 18) throw new Error('Fixture upload exceeds its part bound.')
        return rows.map(({ bytes, ...part }) => ({
          ...part,
          byteLength: bytes.byteLength,
          checksum: checksumCanonicalJson(encodeBase64(new Uint8Array(bytes)))
        }))
      })
    )
    const ledgers = [...campaignLedgers, ...characterLedgers].map(({ payload, ...row }) => ({
      ...row,
      payloadByteLength: payload?.byteLength ?? null
    }))
    const parts = await Promise.all(
      ledgers.map(async (ledger) => {
        const rows = await ctx.db
          .query('receiptLedgerParts')
          .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledger.id))
          .take(20)
        if (rows.length >= 20)
          throw new Error('Checkpoint proof ledger exceeds its inspection bound.')
        return rows.map(({ bytes, ...row }) => ({ ...row, byteLength: bytes.byteLength }))
      })
    )
    return developmentCheckpointInspectionSchema.parse({
      digest: checksumCanonicalJson({
        fixture,
        authority,
        commands,
        characterReceipts,
        ledgers,
        parts,
        campaignRevision,
        playRevision,
        characterRevision,
        uploads,
        uploadParts
      }),
      runVersion: fixture.run.version,
      authority: authority ? presentCampaignLiveAuthority(authority) : null,
      playStreamVersion: fixture.play.streamVersion,
      runChecksum: fixture.run.stateChecksum,
      playChecksum: fixture.play.checksum,
      sharedHeaderCount: commands.length,
      privateHeaderCount: characterReceipts.length,
      stagedUploadCount: uploads.length,
      stagedPartCount: uploadParts.reduce((sum, parts) => sum + parts.length, 0),
      ledgers: ledgers.map(
        ({ _id, _creationTime, payloadByteLength: _payloadByteLength, ...metadata }) =>
          receiptLedgerMetadataSchema.parse(metadata)
      )
    })
  }
})
