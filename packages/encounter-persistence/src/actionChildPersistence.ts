import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerAggregateChoicePendingSnapshotDto,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  completeNativeConcentrationResult,
  NativeConcentrationContext
} from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import type { EncounterDocument, EncounterWriteContext } from './store.js'
import { changedFields } from './documents.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterWritePorts } from './ports.js'

export async function persistNativeConcentrationResult(
  ctx: EncounterWriteContext & {
    ports: Pick<EncounterWritePorts, 'recordConcentrationCheckRoll'>
  },
  input: {
    state: EncounterRunState
    result: ReturnType<typeof completeNativeConcentrationResult>
    occurrence?: EncounterDocument<'encounterRuleOccurrences'>
    commandId: string
    fingerprint: string
    userId: string
    correlationId: string | null
    metadata: ReturnType<typeof serverRuleExecutionReceiptCommandMetadataDtoSchema.parse>
    occurredAt: string
  }
) {
  const { result, state } = input
  const occurrence = encounterStoredRuleOccurrenceSchema.parse({
    id: result.occurrenceId,
    campaignId: state.campaignId,
    encounterId: state.id,
    rootCommandId: concentrationCommandId(result.occurrenceId),
    state: 'COMPLETED',
    version: result.occurrenceVersion,
    expectedEncounterVersion: state.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: result.occurrenceId, encounterId: state.id },
      null
    ),
    completedAt: input.occurredAt,
    createdAt: input.occurrence?.createdAt ?? input.occurredAt,
    updatedAt: input.occurredAt
  })
  if (input.occurrence)
    await ctx.db.patch(input.occurrence._id, changedFields(input.occurrence, occurrence))
  else await ctx.db.insert('encounterRuleOccurrences', occurrence)
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: state.campaignId,
      encounterId: state.id,
      occurrenceId: result.occurrenceId,
      commandId: input.commandId,
      commandType: input.occurrence ? 'RESOLVE_RULE_OCCURRENCE' : 'CONCENTRATION_CHECK',
      commandFingerprint: input.fingerprint,
      encounterVersion: state.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(input.metadata)
      ),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumRuleDocument(result),
      actorUserId: input.userId,
      correlationId: input.correlationId,
      createdAt: input.occurredAt
    })
  )
  // Every settled check, answered or automatic, gets its own roll-log entry.
  await ctx.ports.recordConcentrationCheckRoll({
    state,
    result,
    authorUserId: input.userId,
    occurredAt: input.occurredAt
  })
}

export async function persistNativeConcentrationPending(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    context: NativeConcentrationContext
    continuation: ServerRuleExecutionContinuationDto
    deferredCleaving?: ServerKernelRuleExecutionPendingSnapshotDto['deferredCleaving']
    occurredAt: string
  }
) {
  const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    ...input.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    applicationContext: input.context,
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
    ...(input.deferredCleaving ? { deferredCleaving: input.deferredCleaving } : {})
  })
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', snapshot.occurrenceId))
    .unique()
  if (existing) throw new Error('The concentration child occurrence already exists.')
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: snapshot.occurrenceId,
      campaignId: input.state.campaignId,
      encounterId: input.state.id,
      rootCommandId: concentrationCommandId(snapshot.occurrenceId),
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: input.state.version,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: snapshot.occurrenceId, encounterId: input.state.id },
        snapshot
      ),
      completedAt: null,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt
    })
  )
}

export async function insertNativeCleavingChoice(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  now: string
) {
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', snapshot.occurrenceId))
    .unique()
  if (existing) throw new Error('Cleaving child occurrence already exists.')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id).eq('state', 'PENDING'))
    .take(2)
  if (pending.length) {
    const occurrence = pending[0]!
    const parent = await readPendingSnapshot(ctx, occurrence)
    if (
      pending.length !== 1 ||
      parent?.snapshotKind !== 'KERNEL_EVIDENCE' ||
      parent.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' ||
      snapshot.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' ||
      parent.deferredCleaving ||
      occurrence.expectedEncounterVersion !== state.version
    )
      throw new Error('The Encounter already has a pending decision.')
    const deferred = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...parent,
      deferredCleaving: snapshot.applicationContext
    })
    await ctx.db.patch(occurrence._id, {
      pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, deferred)
    })
    return
  }
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: snapshot.occurrenceId,
      campaignId: state.campaignId,
      encounterId: state.id,
      rootCommandId: cleavingChildCommandIdentity(snapshot.occurrenceId),
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: state.version,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: snapshot.occurrenceId, encounterId: state.id },
        snapshot
      ),
      completedAt: null,
      createdAt: now,
      updatedAt: now
    })
  )
}
